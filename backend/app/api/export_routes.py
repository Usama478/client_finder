from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

from app.db.session import get_db
from app.models.search_result import SearchResult

router = APIRouter(prefix="/api/v1/export", tags=["export"])

@router.post("")
def export_clients_excel(result_ids: Optional[List[str]] = Body(None), db: Session = Depends(get_db)):
    """
    Exports specified clients (or all saved clients) to a formatted Excel file.
    """
    try:
        # 1. Query Data
        query = db.query(SearchResult).filter(SearchResult.is_saved_client == True)
        
        if result_ids and len(result_ids) > 0:
            query = query.filter(SearchResult.place_id.in_(result_ids) | SearchResult.result_id.in_([int(x) for x in result_ids if str(x).isdigit()]))
            
        clients = query.all()

        if not clients:
            raise HTTPException(status_code=404, detail="No clients found to export.")

        # 2. Setup Excel Workbook
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Client List"

        # 3. Define Headers
        headers = [
            "Business Name", 
            "Address", 
            "Website", 
            "Phone Number", 
            "Emails", 
            "Social Links", 
            "Relevance Score", 
            "Relevance Reason", 
            "Verification Score", 
            "Verification Reason", 
            "Risk Flags"
        ]
        
        # Write and Style Headers
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid") # Indigo 600
        
        for col_num, header_title in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num, value=header_title)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")

        # 4. Populate Data Rows
        wrap_alignment = Alignment(wrap_text=True, vertical="top")
        
        for row_num, client in enumerate(clients, 2):
            
            # Format lists or single strings
            email_str = client.email_found or ""
            
            # Note: Social Links are not currently stored natively in the SearchResult columns 
            # as a direct array (they're inside raw_data/scraped_text), so we provide N/A for now.
            socials_str = "N/A"
            risk_str = ", ".join(client.risk_flags) if getattr(client, "risk_flags", None) else ""
            
            row_data = [
                client.business_name or "N/A",
                client.address or "N/A",
                client.website or "N/A",
                client.phone_number or "N/A",
                email_str,
                socials_str,
                client.relevance_score if client.relevance_score is not None else "Pending",
                client.relevance_reason or "",
                client.verification_score if client.verification_score is not None else "Pending",
                client.verification_reason or "",
                risk_str
            ]
            
            for col_num, cell_value in enumerate(row_data, 1):
                cell = ws.cell(row=row_num, column=col_num, value=cell_value)
                
                # Apply word wrap to text-heavy AI explanation columns
                if col_num in [8, 10]: # Relevance Reason, Verification Reason
                    cell.alignment = wrap_alignment
                else:
                    cell.alignment = Alignment(vertical="top")

        # 5. Auto-adjust Column Widths
        column_widths = {
            1: 30, # Business Name
            2: 40, # Address
            3: 30, # Website
            4: 20, # Phone
            5: 35, # Emails
            6: 35, # Socials
            7: 15, # Relevance Score
            8: 60, # Relevance Reason (Wide for AI text)
            9: 15, # Verification Score
            10: 60, # Verification Reason (Wide for AI text)
            11: 30  # Risk Flags
        }
        
        for col_num, width in column_widths.items():
            column_letter = get_column_letter(col_num)
            ws.column_dimensions[column_letter].width = width

        # 6. Save to BytesIO Stream
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)

        # 7. Return StreamingResponse
        timestamp = datetime.now().strftime("%Y-%m-%d")
        filename = f"Client_List_{timestamp}.xlsx"
        
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(
            stream, 
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
            headers=headers
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
