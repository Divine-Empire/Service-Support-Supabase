import { useState, useEffect, useMemo } from "react";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { ListToolbar, ListTable, filterControlClass } from "../../components/shared";
import { useClientList } from "../../hooks/useClientList";
import { COLUMNS, formatInputDate } from "./columns";
import { useInstallationMasters } from "./useInstallationMasters";
import ApprovalDialog from "./ApprovalDialog";
import EnquiryFormModal from "./EnquiryFormModal";

const ServiceInstallation = () => {
  const [installations, setInstallations] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState("");
  // Open forms: the follow-up dialog (an installation row) and the New Enquiry form ({ item, mode }).
  const [approvalItem, setApprovalItem] = useState(null);
  const [enquiry, setEnquiry] = useState(null);
  const { toast } = useToast();
  const { masterData, employeeNames, serviceTypes, ensureCompanies } = useInstallationMasters();

  const fetchInstallations = async () => {
    try {
      setFetchLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("sss_service_installation")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map((row) => ({
        id: row.id,
        "Timestamp": row.created_at || "",
        "Order No.": row.order_no || "",
        "Is Installation Required Or Not?": row.is_installation_required || "",
        "COMPANY NAME": row.company_name || "",
        "CONTACT PERSON NAME": row.contact_person_name || "",
        "CONTACT PERSON NO.": row.contact_person_no || "",
        "Item-Name": row.item_name || "",
        "Qty": row.qty ?? "",
        "Serial": row.serial || "",
        "SI NO": row.si_no || "",
        "INVOICE DATE": row.invoice_date || "",
        "INVOICE NO": row.invoice_no || "",
        "Invoice Copy": row.invoice_copy_upload || "",
        "Actual material rcvd": row.actual_material_rcvd || "",
        "Client Status": row.installation_follow_up || "",
        "Service-Type": row.service_type || "",
        "Engineer Name": row.engineer_name || "",
        "Service Report": row.service_report_file || "",
        "Next Date": row.next_date || "",
        "What Did Customer's Say (Remarks)": row.what_did_customer_say || "",
        _planned1: row.planned || "",
        _actual1: row.actual || "",
      }));

      setInstallations(formattedData);
    } catch (error) {
      console.error("Error fetching installations:", error);
      setLoadError(error.message || "Failed to fetch data");
      toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" });
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Both forms look the company up in the client master, which loads on demand.
  const handleApproveClick = (item) => {
    ensureCompanies();
    setApprovalItem(item);
  };
  const handleEnquiryClick = (item) => {
    ensureCompanies();
    setEnquiry({ item, mode: "history" });
  };
  const handleSiteVisitEnquiry = (item) => {
    setApprovalItem(null);
    setEnquiry({ item, mode: "siteVisit" });
  };

  // Follow-Up Date filter narrows the rows (and the tab counts) before the list hook sees them.
  const dateFiltered = useMemo(
    () => (selectedDateFilter === "" ? installations : installations.filter((i) => formatInputDate(i["Next Date"]) === selectedDateFilter)),
    [installations, selectedDateFilter]
  );
  const pendingRows = useMemo(() => dateFiltered.filter((i) => i._planned1 !== "" && i._actual1 === ""), [dateFiltered]);
  const historyRows = useMemo(() => dateFiltered.filter((i) => i._planned1 !== "" && i._actual1 !== ""), [dateFiltered]);

  const list = useClientList({
    key: "service-installation",
    data: { pending: pendingRows, history: historyRows },
    loading: fetchLoading,
    error: loadError,
    onRetry: fetchInstallations,
    // Same as before: search matches any field of the row.
    searchKeys: (row) => Object.values(row),
    filters: [
      { key: "company", label: "Company", allLabel: "All Companies", get: (r) => r["COMPANY NAME"] },
      { key: "clientStatus", label: "Client Status", allLabel: "All Statuses", get: (r) => r["Client Status"], tabs: ["history"] },
      { key: "serviceType", label: "Service Type", allLabel: "All Service Types", get: (r) => r["Service-Type"], tabs: ["history"] },
      { key: "engineer", label: "Engineer", allLabel: "All Engineers", get: (r) => r["Engineer Name"], tabs: ["history"] },
    ],
    columns: COLUMNS,
    sort: "none", // rows already arrive newest first
  });

  return (
    <div className="space-y-3">
      <ListToolbar
        list={list}
        searchPlaceholder="Search installations..."
        extraFilters={
          <div className="flex items-center gap-2">
            <Label htmlFor="followup-date-filter" className="whitespace-nowrap text-xs font-medium text-muted-foreground">Follow-Up Date</Label>
            <input
              id="followup-date-filter"
              type="date"
              className={`${filterControlClass} w-auto`}
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
            />
            {selectedDateFilter && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDateFilter("")} className="px-2 text-xs">
                Clear
              </Button>
            )}
          </div>
        }
      />
      <ListTable
        list={list}
        ctx={{ onApprove: handleApproveClick, onEnquiry: handleEnquiryClick }}
        rowKey={(r) => r.id}
        emptyTitle={{ pending: "No pending installations.", history: "No installation history." }}
        ariaLabel="Service installations"
      />

      {approvalItem && (
        <ApprovalDialog
          key={approvalItem.id}
          item={approvalItem}
          serviceTypes={serviceTypes}
          employeeNames={employeeNames}
          onClose={() => setApprovalItem(null)}
          onSaved={fetchInstallations}
          onSiteVisitEnquiry={handleSiteVisitEnquiry}
        />
      )}

      {enquiry && (
        <EnquiryFormModal
          key={enquiry.item.id + enquiry.mode}
          item={enquiry.item}
          mode={enquiry.mode}
          masterData={masterData}
          onClose={() => setEnquiry(null)}
        />
      )}
    </div>
  );
};

export default ServiceInstallation;
