"use client";

import { Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ClaimContact } from "@/types/claim";

/** Strip everything but digits, then convert a local 0-prefix to +213 (Algeria). */
function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("213")) return digits;
  if (digits.startsWith("0")) return `213${digits.slice(1)}`;
  return digits;
}

/**
 * Shown only once a claim is approved — the server withholds `contact` until
 * then, so this component simply renders what it is given.
 */
export function ContactReveal({
  contact,
  heading = "Contact details",
  note,
}: {
  contact: ClaimContact;
  heading?: string;
  note?: string;
}) {
  return (
    <Card className="border-found/30 bg-found-muted/50">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-found text-found-foreground"
            aria-hidden
          >
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-heading-4">{heading}</h3>
            <p className="text-body-sm text-muted-foreground">
              {note ?? "Agree a public place and a time that suits you both."}
            </p>
          </div>
        </div>

        <dl className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <dt className="sr-only">Name</dt>
            <dd className="font-medium">{contact.full_name}</dd>
          </div>
          <div className="flex items-center gap-3 text-body-sm">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Email</dt>
            <dd className="min-w-0 truncate">
              <a
                href={`mailto:${contact.email}`}
                className="underline-offset-4 hover:underline"
              >
                {contact.email}
              </a>
            </dd>
          </div>
          {contact.phone ? (
            <div className="flex items-center gap-3 text-body-sm">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Phone</dt>
              <dd>
                <a
                  href={`tel:${contact.phone}`}
                  className="underline-offset-4 hover:underline"
                >
                  {contact.phone}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>

        {contact.phone ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <a
                href={`https://wa.me/${whatsappNumber(contact.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`tel:${contact.phone}`}>
                <Phone className="h-4 w-4" />
                Call
              </a>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
