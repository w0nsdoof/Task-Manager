from django.http import FileResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsManager, IsManagerOrEngineer
from apps.reports.serializers import ReportSummaryResponseSerializer
from apps.reports.services import generate_excel_report, generate_pdf_report, get_report_data

_REPORT_PARAMS = [
    OpenApiParameter("date_from", type=str, description="Start date (YYYY-MM-DD). Filters tasks created on or after."),
    OpenApiParameter("date_to", type=str, description="End date (YYYY-MM-DD). Filters tasks created on or before."),
    OpenApiParameter("client_id", type=int, description="Filter by client ID."),
]


class ReportSummaryView(APIView):
    permission_classes = [IsManagerOrEngineer]

    @extend_schema(
        tags=["Reports"],
        summary="Get report summary data",
        description="Aggregated task statistics. Manager or engineer only.",
        parameters=_REPORT_PARAMS,
        responses={200: ReportSummaryResponseSerializer},
    )
    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        client_id = request.query_params.get("client_id")
        data = get_report_data(date_from, date_to, client_id, organization=request.user.organization)
        return Response(data)


class ReportPDFExportView(APIView):
    permission_classes = [IsManager]

    @extend_schema(
        tags=["Reports"],
        summary="Export report as PDF",
        description="Manager-only. Returns a PDF file download.",
        parameters=_REPORT_PARAMS,
        responses={(200, "application/pdf"): bytes},
    )
    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        client_id = request.query_params.get("client_id")
        data = get_report_data(date_from, date_to, client_id, organization=request.user.organization)
        pdf_buffer = generate_pdf_report(data)

        filename = f"report_{date_from or 'all'}_{date_to or 'all'}.pdf"
        return FileResponse(
            pdf_buffer,
            content_type="application/pdf",
            as_attachment=True,
            filename=filename,
        )


class ReportExcelExportView(APIView):
    permission_classes = [IsManager]

    @extend_schema(
        tags=["Reports"],
        summary="Export report as Excel",
        description="Manager-only. Returns an XLSX file download.",
        parameters=_REPORT_PARAMS,
        responses={(200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"): bytes},
    )
    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        client_id = request.query_params.get("client_id")
        data = get_report_data(date_from, date_to, client_id, organization=request.user.organization)
        excel_buffer = generate_excel_report(data)

        filename = f"report_{date_from or 'all'}_{date_to or 'all'}.xlsx"
        return FileResponse(
            excel_buffer,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            filename=filename,
        )
