import csv
import io
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from ..models import CalculateRequest
from ..bridge import run_calculation

router = APIRouter()


@router.post("/export/csv")
def export_csv(req: CalculateRequest):
    """Download calculatie als CSV."""
    res = run_calculation(req)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")

    # Header
    writer.writerow(["Maven Calculatie", res.titel])
    writer.writerow([])

    # Eenmalige kosten
    writer.writerow(["EENMALIGE KOSTEN"])
    writer.writerow(["Productie", f"{res.totaal_productie:.2f}"])
    writer.writerow(["Offline marketing", f"{res.totaal_offline_marketing:.2f}"])
    writer.writerow(["Online marketing", f"{res.totaal_online_marketing:.2f}"])
    writer.writerow(["Drukkosten 1e druk", f"{res.drukkosten_totaal_1e:.2f}"])
    writer.writerow([])

    # Per druk
    for druk in res.drukken:
        writer.writerow([druk.druk_type.upper(), f"Oplage: {druk.oplage}"])
        writer.writerow([
            "", "Webshop", "", "Retail (CB)", "", "B2B", "",
        ])
        writer.writerow([
            "", "Bedrag", "Marge%", "Bedrag", "Marge%", "Bedrag", "Marge%",
        ])

        for kanaal_label, k in [
            ("Netto omzet", [druk.webshop, druk.retail, druk.b2b]),
        ]:
            writer.writerow([
                kanaal_label,
                f"{k[0].netto_omzet:.2f}", "",
                f"{k[1].netto_omzet:.2f}", "",
                f"{k[2].netto_omzet:.2f}", "",
            ])

        # Netto winst
        writer.writerow([
            "Netto winst Maven",
            f"{druk.webshop.netto_winst_maven:.2f}",
            f"{druk.webshop.marge_pct:.1%}",
            f"{druk.retail.netto_winst_maven:.2f}",
            f"{druk.retail.marge_pct:.1%}",
            f"{druk.b2b.netto_winst_maven:.2f}",
            f"{druk.b2b.marge_pct:.1%}",
        ])

        # Gewogen
        writer.writerow([
            "Gewogen marge",
            f"{druk.gewogen_netto_winst:.2f}",
            f"{druk.gewogen_marge_pct:.1%}",
        ])
        writer.writerow([])

    output.seek(0)
    filename = f"calculatie_{res.titel.replace(' ', '_')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
