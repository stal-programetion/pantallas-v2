"""CLI de ingesta ETL de Digiturno.

Uso:
  python -m app.etl.cli --file ../data/Historicos_Turnos_MAY2026.xlsx
  python -m app.etl.cli --generate-demo --import-demo
"""

import argparse
from pathlib import Path

from app.database import Base, SessionLocal, engine
from app.etl.excel_importer import import_digiturno_excel
from seed.generate_synthetic_digiturno import generate_demo_excel


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL Digiturno Surtigas")
    parser.add_argument("--file", type=str, help="Ruta al archivo .xlsx de Digiturno")
    parser.add_argument("--sheet", type=str, default="Mayo 2026", help="Nombre de la hoja Excel")
    parser.add_argument("--generate-demo", action="store_true", help="Genera el Excel demo sintético calibrado")
    parser.add_argument("--import-demo", action="store_true", help="Importa el Excel demo sintético a la BD")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    demo_path = Path(__file__).resolve().parents[2] / "seed" / "demo_digiturno_may2026.xlsx"

    if args.generate_demo:
        generate_demo_excel(demo_path)
        print(f"Excel demo generado: {demo_path}")

    target_file = Path(args.file) if args.file else (demo_path if args.import_demo else None)
    if target_file:
        with SessionLocal() as db:
            report = import_digiturno_excel(
                db,
                target_file,
                sheet_name=args.sheet,
                is_synthetic=args.import_demo and not args.file,
                source_type="synthetic_demo" if args.import_demo and not args.file else "excel",
            )
            print("Resumen ETL:")
            print(report.model_dump_json(indent=2, by_alias=True))


if __name__ == "__main__":
    main()
