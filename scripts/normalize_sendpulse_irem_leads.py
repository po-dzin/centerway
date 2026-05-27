from __future__ import annotations

import csv
import re
from pathlib import Path
from urllib.parse import quote

import pandas as pd


SOURCE_FILE = Path("/Users/G/Downloads/Leads DB (smartsender).xlsx")
OUTPUT_DIR = Path("outputs/sendpulse_irem_20260526")
CAMPAIGN = "launch_may_2026_email"
SOURCE = "sendpulse"
PROMO_URL_TEMPLATE = (
    "https://irem.centerway.net.ua/go/irem"
    "?email={email}&campaign={campaign}&source=sendpulse&utm_source=sendpulse"
)

CANONICAL_COLUMNS = [
    "firstName",
    "lastName",
    "fullName",
    "email",
    "phone",
    "photo",
    "currentDate",
    "creationDate",
    "userId",
    "basket",
    "Квиз Вата",
    "Квиз Питта",
    "Квиз Капха",
    "system_browser",
    "system_city",
    "system_continent",
    "system_country",
    "system_date_of_birth",
    "system_device_mcc",
    "system_device_mnc",
    "system_device_type",
    "system_gender",
    "system_instagram_username",
    "system_ip_address",
    "system_language",
    "system_os",
    "system_telegram_username",
    "system_timezone",
    "system_user_agent",
    "purchases",
    "funnels",
    "tags",
]

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_text(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def normalize_email(value: object) -> str:
    email = normalize_text(value).lower()
    return email


def normalize_phone(value: object) -> str:
    phone = normalize_text(value)
    if not phone:
        return ""
    return re.sub(r"\s+", "", phone)


def normalize_timestamp(value: object) -> str:
    if pd.isna(value):
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat(sep=" ", timespec="seconds")
    return normalize_text(value)


def normalize_user_id(value: object) -> str:
    if pd.isna(value):
        return ""
    try:
        return str(int(float(value)))
    except (TypeError, ValueError):
        return normalize_text(value)


def build_promo_link(email: str) -> str:
    return PROMO_URL_TEMPLATE.format(email=quote(email), campaign=CAMPAIGN)


def main() -> None:
    raw = pd.read_excel(SOURCE_FILE, header=None)
    raw.columns = CANONICAL_COLUMNS

    # One row inside the export repeats the headers as data.
    raw = raw[raw["email"].astype(str).str.lower() != "email"].copy()

    raw["first_name"] = raw["firstName"].map(normalize_text)
    raw["last_name"] = raw["lastName"].map(normalize_text)
    raw["full_name"] = raw["fullName"].map(normalize_text)
    raw["email"] = raw["email"].map(normalize_email)
    raw["phone"] = raw["phone"].map(normalize_phone)
    raw["smartsender_user_id"] = raw["userId"].map(normalize_user_id)
    raw["tg_username"] = raw["system_telegram_username"].map(normalize_text)
    raw["created_at"] = raw["creationDate"].map(normalize_timestamp)
    raw["last_seen_at"] = raw["currentDate"].map(normalize_timestamp)
    raw["tags"] = raw["tags"].map(normalize_text)

    contacts = raw[raw["email"] != ""].copy()
    contacts = contacts[contacts["email"].map(lambda value: bool(EMAIL_RE.match(value)))]
    contacts = contacts.sort_values(["email", "last_seen_at"], ascending=[True, False])
    contacts = contacts.drop_duplicates(subset=["email"], keep="first")

    contacts["campaign"] = CAMPAIGN
    contacts["source"] = SOURCE
    contacts["recipient_key"] = contacts["email"].map(lambda email: f"email:{email}")
    contacts["promo_link"] = contacts["email"].map(build_promo_link)

    final_columns = [
        "email",
        "first_name",
        "last_name",
        "full_name",
        "phone",
        "promo_link",
        "campaign",
        "source",
        "recipient_key",
        "smartsender_user_id",
        "tg_username",
        "created_at",
        "last_seen_at",
        "tags",
    ]
    final_df = contacts[final_columns].sort_values(["full_name", "email"]).reset_index(drop=True)
    compact_df = final_df[["email", "first_name", "full_name"]].copy()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUTPUT_DIR / "sendpulse_irem_contacts.csv"
    xlsx_path = OUTPUT_DIR / "sendpulse_irem_contacts.xlsx"
    compact_csv_path = OUTPUT_DIR / "sendpulse_irem_contacts_compact.csv"
    compact_xlsx_path = OUTPUT_DIR / "sendpulse_irem_contacts_compact.xlsx"

    final_df.to_csv(csv_path, index=False, encoding="utf-8-sig", quoting=csv.QUOTE_MINIMAL)
    final_df.to_excel(xlsx_path, index=False)
    compact_df.to_csv(compact_csv_path, index=False, encoding="utf-8-sig", quoting=csv.QUOTE_MINIMAL)
    compact_df.to_excel(compact_xlsx_path, index=False)

    print(f"rows_raw={len(raw)}")
    print(f"rows_with_email={len(raw[raw['email'] != ''])}")
    print(f"rows_final={len(final_df)}")
    print(f"csv={csv_path}")
    print(f"xlsx={xlsx_path}")
    print(f"compact_csv={compact_csv_path}")
    print(f"compact_xlsx={compact_xlsx_path}")


if __name__ == "__main__":
    main()
