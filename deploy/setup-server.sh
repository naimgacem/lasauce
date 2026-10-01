#!/usr/bin/env bash
# One-time preparation of a fresh Ubuntu server (22.04 or 24.04, x86 or ARM).
# Safe to run again. Run as the default user (e.g. `ubuntu`), not as root:
#
#   bash deploy/setup-server.sh
#
# Installs Docker, adds swap, and opens ports 80/443 in the host firewall.
set -euo pipefail

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

say "Docker"
if command -v docker >/dev/null 2>&1; then
  echo "already installed: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sudo sh
fi
# Lets this user run `docker` without sudo (takes effect at next login).
sudo usermod -aG docker "$USER"

say "Swap"
# Building the AI worker image and loading its models both spike memory; on a
# 4 GB machine that is the difference between slow and killed.
if [ "$(swapon --show --noheadings | wc -l)" -gt 0 ]; then
  echo "swap already active"
else
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo "4 GB swap enabled"
fi

say "Firewall"
# Oracle Cloud's Ubuntu images ship an iptables policy that rejects all inbound
# traffic except SSH. Accept 80/443 ahead of that reject rule. On images without
# such a rule (Azure, most others) there is nothing to change here — open the
# ports in the provider's network settings instead.
if sudo iptables -S INPUT 2>/dev/null | grep -q -- '-j REJECT'; then
  for port in 80 443; do
    sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null \
      || sudo iptables -I INPUT -p tcp --dport "$port" -j ACCEPT
  done
  sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT -p udp --dport 443 -j ACCEPT
  if command -v netfilter-persistent >/dev/null 2>&1; then
    sudo netfilter-persistent save >/dev/null
  fi
  echo "opened 80/tcp, 443/tcp, 443/udp"
else
  echo "no host firewall rule to change"
fi

say "Done"
echo "Log out and back in once (so 'docker' works without sudo), then follow deploy/README.md."
