"""Canonical list of Algeria's 58 wilayas.

Items store the **code** (1–58), never the name, so that a wilaya can be
rendered in Arabic, French or English without touching stored data. Codes are
the official administrative numbers and are stable.

The 10 wilayas numbered 49–58 were created by the 2019 administrative reform.

Mirrored on the client in `frontend/src/lib/algeria-wilayas.ts` — this is static
reference data, so a copy on each side is deliberate: the select renders
instantly with no round-trip, and the API still validates what it is sent.
"""

from __future__ import annotations

WILAYAS: dict[int, str] = {
    1: "Adrar",
    2: "Chlef",
    3: "Laghouat",
    4: "Oum El Bouaghi",
    5: "Batna",
    6: "Béjaïa",
    7: "Biskra",
    8: "Béchar",
    9: "Blida",
    10: "Bouira",
    11: "Tamanrasset",
    12: "Tébessa",
    13: "Tlemcen",
    14: "Tiaret",
    15: "Tizi Ouzou",
    16: "Alger",
    17: "Djelfa",
    18: "Jijel",
    19: "Sétif",
    20: "Saïda",
    21: "Skikda",
    22: "Sidi Bel Abbès",
    23: "Annaba",
    24: "Guelma",
    25: "Constantine",
    26: "Médéa",
    27: "Mostaganem",
    28: "M'Sila",
    29: "Mascara",
    30: "Ouargla",
    31: "Oran",
    32: "El Bayadh",
    33: "Illizi",
    34: "Bordj Bou Arréridj",
    35: "Boumerdès",
    36: "El Tarf",
    37: "Tindouf",
    38: "Tissemsilt",
    39: "El Oued",
    40: "Khenchela",
    41: "Souk Ahras",
    42: "Tipaza",
    43: "Mila",
    44: "Aïn Defla",
    45: "Naâma",
    46: "Aïn Témouchent",
    47: "Ghardaïa",
    48: "Relizane",
    # --- created by the 2019 reform ---
    49: "Timimoun",
    50: "Bordj Badji Mokhtar",
    51: "Ouled Djellal",
    52: "Béni Abbès",
    53: "In Salah",
    54: "In Guezzam",
    55: "Touggourt",
    56: "Djanet",
    57: "El M'Ghair",
    58: "El Meniaa",
}

WILAYA_CODE_MIN = 1
WILAYA_CODE_MAX = 58


def is_valid_wilaya(code: int | None) -> bool:
    return code is None or code in WILAYAS


def wilaya_name(code: int | None) -> str | None:
    return WILAYAS.get(code) if code is not None else None
