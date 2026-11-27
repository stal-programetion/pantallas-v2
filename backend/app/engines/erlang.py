"""Motor de teoría de colas M/M/c (Erlang C) y variante con abandono M/M/c+M (Erlang A)."""

from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class ErlangEvaluation:
    tasa_llegadas_hora: float
    tiempo_atencion_min: float
    intensidad_trafico: float
    agentes_asignados: int
    probabilidad_espera: float
    nivel_servicio: float
    tiempo_espera_promedio_min: float
    tasa_abandono_estimada: float
    es_estable: bool


def calculate_erlang_c_probability(c: int, traffic_a: float) -> float:
    """Calcula P(W > 0) = C(c, A) mediante recursión numéricamente estable."""
    if traffic_a <= 0:
        return 0.0
    if c <= 0 or c <= traffic_a:
        return 1.0

    total_sum = 1.0
    term = 1.0
    for k in range(1, c):
        term *= traffic_a / k
        total_sum += term

    term_c = term * (traffic_a / c)
    queue_component = term_c * (c / (c - traffic_a))
    denominator = total_sum + queue_component
    if denominator <= 0:
        return 1.0
    pw = queue_component / denominator
    return min(max(pw, 0.0), 1.0)


def evaluate_erlang_c(
    lambda_hour: float,
    avg_service_time_min: float,
    agents: int,
    target_wait_min: float = 10.0,
) -> ErlangEvaluation:
    """Evalúa KPIs clásicos M/M/c (Erlang C)."""
    if lambda_hour <= 0:
        return ErlangEvaluation(
            tasa_llegadas_hora=0.0,
            tiempo_atencion_min=round(avg_service_time_min, 2),
            intensidad_trafico=0.0,
            agentes_asignados=max(1, agents),
            probabilidad_espera=0.0,
            nivel_servicio=1.0,
            tiempo_espera_promedio_min=0.0,
            tasa_abandono_estimada=0.0,
            es_estable=True,
        )

    service_min = max(0.5, avg_service_time_min)
    mu = 60.0 / service_min
    traffic_a = lambda_hour / mu

    if agents <= 0 or agents <= traffic_a:
        # Sistema saturado en M/M/c puro
        overload_ratio = min(3.0, traffic_a / max(1, agents))
        return ErlangEvaluation(
            tasa_llegadas_hora=round(lambda_hour, 2),
            tiempo_atencion_min=round(service_min, 2),
            intensidad_trafico=round(traffic_a, 2),
            agentes_asignados=max(0, agents),
            probabilidad_espera=1.0,
            nivel_servicio=round(max(0.02, 0.15 / overload_ratio), 4),
            tiempo_espera_promedio_min=round(min(90.0, 28.0 * overload_ratio), 2),
            tasa_abandono_estimada=round(min(0.45, 0.12 * overload_ratio), 4),
            es_estable=False,
        )

    pw = calculate_erlang_c_probability(agents, traffic_a)
    excess_capacity = agents * mu - lambda_hour
    wq_hours = pw / excess_capacity
    wq_min = max(0.0, wq_hours * 60.0)
    sl = 1.0 - pw * math.exp(-excess_capacity * (target_wait_min / 60.0))
    sl = min(max(sl, 0.0), 1.0)

    # Estimación aproximada de abandono en régimen estable proporcional a espera > umbral
    est_abandon = min(0.25, pw * math.exp(-target_wait_min / max(wq_min, 1.0)) * 0.25) if wq_min > 1.0 else 0.0

    return ErlangEvaluation(
        tasa_llegadas_hora=round(lambda_hour, 2),
        tiempo_atencion_min=round(service_min, 2),
        intensidad_trafico=round(traffic_a, 2),
        agentes_asignados=agents,
        probabilidad_espera=round(pw, 4),
        nivel_servicio=round(sl, 4),
        tiempo_espera_promedio_min=round(wq_min, 2),
        tasa_abandono_estimada=round(est_abandon, 4),
        es_estable=True,
    )


def evaluate_erlang_a(
    lambda_hour: float,
    avg_service_time_min: float,
    agents: int,
    target_wait_min: float = 10.0,
    avg_patience_min: float = 28.0,
) -> ErlangEvaluation:
    """Variante Erlang A (M/M/c+M) usando cadenas de nacimiento y muerte truncadas.

    Permite obtener tiempo de espera, nivel de servicio y tasa de abandono reales
    incluso cuando la oficina opera cerca o por encima de rho=1.
    """
    if lambda_hour <= 0:
        return evaluate_erlang_c(0.0, avg_service_time_min, agents, target_wait_min)
    if agents <= 0:
        return ErlangEvaluation(
            tasa_llegadas_hora=round(lambda_hour, 2),
            tiempo_atencion_min=round(avg_service_time_min, 2),
            intensidad_trafico=round(lambda_hour * avg_service_time_min / 60.0, 2),
            agentes_asignados=0,
            probabilidad_espera=1.0,
            nivel_servicio=0.0,
            tiempo_espera_promedio_min=60.0,
            tasa_abandono_estimada=1.0,
            es_estable=False,
        )

    service_min = max(0.5, avg_service_time_min)
    mu = 60.0 / service_min
    theta = 60.0 / max(2.0, avg_patience_min)  # Tasa de abandono por hora de espera
    traffic_a = lambda_hour / mu

    # Capacidad truncada K suficiente para convergencia exacta
    max_states = agents + max(60, int(traffic_a * 4))
    ratios = [1.0]
    for n in range(1, max_states + 1):
        departure_rate = n * mu if n <= agents else (agents * mu + (n - agents) * theta)
        ratios.append(ratios[-1] * (lambda_hour / departure_rate))

    norm = sum(ratios)
    probs = [r / norm for r in ratios]

    pw = sum(probs[n] for n in range(agents, len(probs)))
    avg_queue_len = sum((n - agents) * probs[n] for n in range(agents + 1, len(probs)))
    abandon_rate_hour = theta * avg_queue_len
    p_abandon = min(max(abandon_rate_hour / lambda_hour, 0.0), 1.0)

    # Ley de Little aplicada sobre cola
    wq_min = max(0.0, (avg_queue_len / lambda_hour) * 60.0)
    # Nivel de servicio aproximado para clientes que permanecen y esperan <= target_wait_min
    if wq_min <= 0.01:
        sl = 1.0
    else:
        sl_cond = 1.0 - math.exp(-target_wait_min / max(wq_min, 0.5))
        sl = (1.0 - pw) + pw * (1.0 - p_abandon) * sl_cond
        sl = min(max(sl, 0.0), 1.0)

    return ErlangEvaluation(
        tasa_llegadas_hora=round(lambda_hour, 2),
        tiempo_atencion_min=round(service_min, 2),
        intensidad_trafico=round(traffic_a, 2),
        agentes_asignados=agents,
        probabilidad_espera=round(min(max(pw, 0.0), 1.0), 4),
        nivel_servicio=round(sl, 4),
        tiempo_espera_promedio_min=round(wq_min, 2),
        tasa_abandono_estimada=round(p_abandon, 4),
        es_estable=agents > traffic_a,
    )


def calculate_required_agents(
    lambda_hour: float,
    avg_service_time_min: float,
    target_sla: float = 0.80,
    target_wait_min: float = 10.0,
    max_capacity: int = 15,
) -> tuple[int, ErlangEvaluation]:
    """Determina el mínimo número de agentes para alcanzar el SLA objetivo."""
    if lambda_hour <= 0:
        return 1, evaluate_erlang_c(0.0, avg_service_time_min, 1, target_wait_min)

    mu = 60.0 / max(0.5, avg_service_time_min)
    traffic_a = lambda_hour / mu
    min_agents = max(1, math.floor(traffic_a) + 1)

    upper = max(max_capacity + 4, min_agents + 6)
    best_eval = evaluate_erlang_c(lambda_hour, avg_service_time_min, min_agents, target_wait_min)
    for c in range(min_agents, upper + 1):
        res = evaluate_erlang_c(lambda_hour, avg_service_time_min, c, target_wait_min)
        best_eval = res
        if res.nivel_servicio >= target_sla:
            return c, res

    return max(min_agents, max_capacity), best_eval
