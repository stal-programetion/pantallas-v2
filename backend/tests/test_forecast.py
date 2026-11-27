"""Pruebas del pronóstico de demanda y patrones horarios/semanales."""

from sqlalchemy.orm import Session

from app.engines.forecast import get_office_day_forecast


def test_forecast_reproduces_peaks_valley_and_weekday_pattern(db_session: Session):
    monday = {f.franja: f for f in get_office_day_forecast(db_session, "cartagena-chambacu", day_of_week=1, is_fortnight=False)}
    friday = {f.franja: f for f in get_office_day_forecast(db_session, "cartagena-chambacu", day_of_week=5, is_fortnight=False)}

    # Pico 8-10h supera al valle de 12h
    morning_peak = max(monday["08:30"].tasa_llegadas_hora, monday["09:00"].tasa_llegadas_hora, monday["10:00"].tasa_llegadas_hora)
    valley_12 = monday["12:00"].tasa_llegadas_hora
    afternoon_14 = monday["14:00"].tasa_llegadas_hora

    assert morning_peak > valley_12
    assert afternoon_14 > valley_12

    # Lunes > Viernes
    total_mon = sum(f.llegadas_esperadas for f in monday.values())
    total_fri = sum(f.llegadas_esperadas for f in friday.values())
    assert total_mon > total_fri


def test_forecast_includes_confidence_intervals_and_fortnight_boost(db_session: Session):
    normal = get_office_day_forecast(db_session, "monteria-centro", day_of_week=1, is_fortnight=False)
    fortnight = get_office_day_forecast(db_session, "monteria-centro", day_of_week=1, is_fortnight=True)

    for n, f in zip(normal, fortnight):
        assert n.ic_inferior <= n.llegadas_esperadas <= n.ic_superior
        assert f.tasa_llegadas_hora >= n.tasa_llegadas_hora
