"""Generador sintético calibrado de históricos Digiturno (22.611 turnos, mayo 2026).

Solo se usa como demostración reproducible cuando el Excel real
`data/Historicos_Turnos_MAY2026.xlsx` aún no ha sido provisto.
"""

from datetime import datetime, timedelta
from pathlib import Path
import random

from openpyxl import Workbook

# Volúmenes, esperas promedio (min), atención promedio (min), operadores y abandono (%)
OFFICE_PROFILES = [
    ("OF-01", "cartagena-chambacu", "Cartagena", "Sede Principal", "Bolívar", "Cartagena", 4703, 80.4, 12.8, 13, 0.104),
    ("OF-02", "monteria-centro", "Montería", "Sala Central", "Córdoba", "Montería", 3478, 42.4, 8.8, 9, 0.106),
    ("OF-03", "sincelejo-la-palma", "Sincelejo", "La Palma", "Sucre", "Sincelejo", 2404, 40.8, 11.1, 8, 0.082),
    ("OF-04", "cerete", "Cereté", "Sala Única", "Córdoba", "Cereté", 1579, 19.9, 7.5, 3, 0.002),
    ("OF-05", "turbaco", "Turbaco", "Sala Principal", "Bolívar", "Turbaco", 1554, 30.7, 9.9, 6, 0.024),
    ("OF-06", "magangue", "Magangué", "Sala Única", "Bolívar", "Magangué", 1435, 24.3, 8.2, 3, 0.114),
    ("OF-07", "corozal", "Corozal", "Sala Única", "Sucre", "Corozal", 1256, 13.9, 5.9, 3, 0.018),
    ("OF-08", "sahagun", "Sahagún", "Sala Única", "Córdoba", "Sahagún", 1246, 17.7, 6.8, 4, 0.039),
    ("OF-09", "el-carmen-de-bolivar", "Carmen de Bolívar", "Sala Única", "Bolívar", "El Carmen de Bolívar", 1056, 14.4, 5.9, 4, 0.053),
    ("OF-10", "lorica", "Lorica", "Sala Única", "Córdoba", "Lorica", 916, 9.2, 6.3, 1, 0.058),
    ("OF-11", "mompox", "Mompox", "Sala Única", "Bolívar", "Mompox", 912, 14.2, 6.5, 3, 0.049),
    ("OF-12", "caucasia", "Caucasia", "Sala Única", "Antioquia", "Caucasia", 841, 12.5, 6.4, 3, 0.008),
    ("OF-13", "tolu", "Tolú", "Sala Única", "Sucre", "Tolú", 817, 18.4, 8.1, 1, 0.061),
    ("OF-14", "planeta-rica", "Planeta Rica", "Sala Única", "Córdoba", "Planeta Rica", 414, 5.7, 7.1, 2, 0.005),
]

# 19 días hábiles de mayo 2026 (excluye sábados, domingos, 1 de mayo y 18 de mayo festivos CO)
BUSINESS_DAYS_MAY_2026 = [
    datetime(2026, 5, 4), datetime(2026, 5, 5), datetime(2026, 5, 6), datetime(2026, 5, 7), datetime(2026, 5, 8),
    datetime(2026, 5, 11), datetime(2026, 5, 12), datetime(2026, 5, 13), datetime(2026, 5, 14), datetime(2026, 5, 15),
    datetime(2026, 5, 19), datetime(2026, 5, 20), datetime(2026, 5, 21), datetime(2026, 5, 22),
    datetime(2026, 5, 25), datetime(2026, 5, 26), datetime(2026, 5, 27), datetime(2026, 5, 28), datetime(2026, 5, 29),
]

# Pesos exactos por hora (7h..16h)
HOUR_WEIGHTS = {
    7: 2310,
    8: 3771,
    9: 3852,
    10: 3439,
    11: 2112,
    12: 987,   # Valle almuerzo
    13: 1470,
    14: 2483,  # Segundo pico
    15: 1958,
    16: 195,
}

# Lunes más cargado que viernes
WEEKDAY_WEIGHTS = {
    0: 1.32,  # Lunes
    1: 1.08,  # Martes
    2: 1.00,  # Miércoles
    3: 0.96,  # Jueves
    4: 0.72,  # Viernes
}

SERVICES = [
    ("Información", 0.24),
    ("Peticiones", 0.14),
    ("Solicitudes", 0.16),
    ("Reclamos", 0.16),
    ("Convenio de pago", 0.20),
    ("Radicación de carta", 0.10),
]

CLIENT_TYPES = [
    ("General", 0.76),
    ("Preferencial", 0.14),
    ("Empresas", 0.06),
    ("Agendado", 0.04),
]


def format_colombian_datetime(dt: datetime) -> str:
    """Formatea fecha en estilo Digiturno español colombiano: '4/05/2026 8:09:38 a. m.'"""
    hour_12 = dt.hour % 12
    if hour_12 == 0:
        hour_12 = 12
    ampm = "a. m." if dt.hour < 12 else "p. m."
    return f"{dt.day}/{dt.month:02d}/{dt.year} {hour_12}:{dt.minute:02d}:{dt.second:02d} {ampm}"


def _weighted_choice(rng: random.Random, options: list[tuple[str, float]]) -> str:
    r = rng.random()
    acc = 0.0
    for label, weight in options:
        acc += weight
        if r <= acc:
            return label
    return options[-1][0]


def generate_demo_excel(output_path: str | Path, seed: int = 202605) -> Path:
    """Genera el Excel sintético calibrado con 22.611 turnos en hoja 'Mayo 2026'."""
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)

    wb = Workbook(write_only=True)
    ws = wb.create_sheet(title="Mayo 2026")

    headers = [
        "IdTurno", "Fecha", "IdOficina", "NombreOficina", "NombreSala",
        "Numero", "IdServicio", "Tipo", "OrigenTurno", "Estado",
        "TiempoInicioEspera", "TiempoEspera", "TiempoInicioAtencion",
        "TiempoFinAtencion", "TiempoAtencion", "IdUsuario", "NombreOperador",
        "NombreTerminal", "NombreCola", "NombreElementoNodoNivel2",
        "NombreElementoNodoNivel4", "NombreNivelGeografico2",
        "NombreNivelGeografico3", "Calificacion",
    ]
    ws.append(headers)

    hours = list(HOUR_WEIGHTS.keys())
    hour_probs = [HOUR_WEIGHTS[h] for h in hours]

    day_weights = [WEEKDAY_WEIGHTS[d.weekday()] for d in BUSINESS_DAYS_MAY_2026]

    turn_seq = 1
    operator_counter = 1
    office_operators: dict[str, list[tuple[str, str, str]]] = {}
    for prof in OFFICE_PROFILES:
        of_id = prof[1]
        num_ops = max(1, min(prof[9], 6))
        ops = []
        for idx in range(num_ops):
            op_num = ((operator_counter - 1) % 38) + 1
            ops.append((f"USR-{op_num:03d}", f"Operador Demo {op_num:02d}", f"TERM-{prof[0]}-{idx + 1:02d}"))
            operator_counter += 1
        office_operators[of_id] = ops

    for prof in OFFICE_PROFILES:
        (
            raw_of_id, slug, nombre_of, sala, depto, ciudad,
            target_count, wait_avg_min, svc_avg_min, _, aba_rate,
        ) = prof
        ops = office_operators[slug]

        for i in range(target_count):
            day = rng.choices(BUSINESS_DAYS_MAY_2026, weights=day_weights, k=1)[0]
            hour = rng.choices(hours, weights=hour_probs, k=1)[0]
            minute = rng.randint(0, 29 if hour == 16 else 59)
            second = rng.randint(0, 59)
            arrival_dt = day.replace(hour=hour, minute=minute, second=second)

            # Factor quincena (14-15 y 28-29) y hora pico aumentan espera
            is_fortnight = day.day in (14, 15, 28, 29)
            peak_factor = 1.35 if hour in (8, 9, 10, 14) else (0.70 if hour in (12, 16) else 1.0)
            fortnight_factor = 1.18 if is_fortnight else 1.0

            r_state = rng.random()
            if r_state < aba_rate:
                estado = "ABA"
            elif r_state < aba_rate + 0.06:
                estado = "CAN"
            else:
                estado = "FIN"

            wait_sec = max(15, int(rng.expovariate(1.0 / (wait_avg_min * 60.0 * peak_factor * fortnight_factor))))
            wait_sec = min(wait_sec, 14400)

            if estado == "FIN":
                svc_sec = max(45, int(rng.expovariate(1.0 / (svc_avg_min * 60.0))))
                svc_sec = min(svc_sec, 5400)
                start_att_dt = arrival_dt + timedelta(seconds=wait_sec)
                end_att_dt = start_att_dt + timedelta(seconds=svc_sec)
                start_att_str = format_colombian_datetime(start_att_dt)
                end_att_str = format_colombian_datetime(end_att_dt)
            else:
                svc_sec = 0
                start_att_str = ""
                end_att_str = ""

            op_uid, op_name, term = rng.choice(ops)
            client_type = _weighted_choice(rng, CLIENT_TYPES)
            service_type = _weighted_choice(rng, SERVICES)
            origen = "Atril" if rng.random() < 0.98 else "Digiturno"
            tipo_turno = "TUR" if rng.random() < 0.94 else "ADI"

            ws.append([
                f"MAY26-{turn_seq:06d}",
                "04/05/2026",  # Columna Fecha deliberadamente duplicada/no confiable como en el Excel real
                raw_of_id,
                nombre_of,
                sala,
                f"T{turn_seq % 999:03d}",
                f"SRV-{(turn_seq % 6) + 1}",
                tipo_turno,
                origen,
                estado,
                format_colombian_datetime(arrival_dt),
                wait_sec,
                start_att_str,
                end_att_str,
                svc_sec,
                op_uid,
                op_name,
                term,
                f"Cola {client_type}",
                client_type,
                service_type,
                depto,
                ciudad,
                0,  # Calificacion = 0 como en el Excel real
            ])
            turn_seq += 1

    wb.save(out)
    return out


if __name__ == "__main__":
    path = Path(__file__).resolve().parent / "demo_digiturno_may2026.xlsx"
    generated = generate_demo_excel(path)
    print(f"Generado Excel sintético calibrado en: {generated}")
