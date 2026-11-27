"""Pruebas unitarias para Erlang C, Erlang A y coherencia con 3 oficinas reales."""

from app.engines.erlang import (
    calculate_erlang_c_probability,
    calculate_required_agents,
    evaluate_erlang_a,
    evaluate_erlang_c,
)


def test_erlang_c_reference_mm1_case():
    # Para c=1, P(W > 0) = rho = A = lambda / mu
    pw = calculate_erlang_c_probability(1, 0.6)
    assert abs(pw - 0.6) < 1e-6

    # M/M/1: lambda=6/h, service=6 min (mu=10/h) => rho=0.6, Wq = rho / (mu*(1-rho)) = 0.6 / 4 h = 9 min
    res = evaluate_erlang_c(lambda_hour=6.0, avg_service_time_min=6.0, agents=1, target_wait_min=10.0)
    assert res.es_estable is True
    assert abs(res.tiempo_espera_promedio_min - 9.0) < 0.05


def test_erlang_c_unstable_when_agents_below_traffic():
    res = evaluate_erlang_c(lambda_hour=20.0, avg_service_time_min=10.0, agents=3, target_wait_min=10.0)
    # A = 20 / 6 = 3.33 > 3
    assert res.es_estable is False
    assert res.probabilidad_espera == 1.0


def test_erlang_a_handles_high_load_with_abandonment():
    ev = evaluate_erlang_a(lambda_hour=30.0, avg_service_time_min=12.8, agents=6, target_wait_min=10.0, avg_patience_min=25.0)
    assert 0.0 < ev.tasa_abandono_estimada < 1.0
    assert ev.tiempo_espera_promedio_min > 0.0


def test_erlang_c_coherent_across_three_real_offices():
    # Basado en métricas históricas de Cartagena (12.8 min), Montería (8.8 min) y Sincelejo (11.1 min)
    offices_samples = [
        ("Cartagena", 30.0, 12.8, 13),  # A = 6.4 Erlangs con 13 operadores -> estable si distribución pareja
        ("Montería", 22.0, 8.8, 9),     # A = 3.23 Erlangs
        ("Sincelejo", 15.0, 11.1, 8),   # A = 2.78 Erlangs
    ]
    for name, lam, svc, cap in offices_samples:
        req, eval_res = calculate_required_agents(lam, svc, target_sla=0.80, target_wait_min=15.0, max_capacity=cap)
        assert req >= 1, f"{name} requiere >=1 agente"
        assert eval_res.nivel_servicio >= 0.80, f"{name} debe cumplir SLA >= 80%"
        assert eval_res.es_estable is True
