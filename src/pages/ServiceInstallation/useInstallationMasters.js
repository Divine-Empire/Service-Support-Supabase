import { useState, useEffect, useMemo, useRef } from "react";
import { useToast } from "../../hooks/use-toast";
import { ltoSupabase } from "../../lib/supabase/ltoClient";
import { fetchAllRows } from "../../lib/fetchAllRows";
import { fetchDropdownRows } from "../../lib/supabase/dropdown";
import { fetchEngineerNames } from "../../lib/supabase/engineers";

// Dropdown category holding the Service-Type options this page's follow-up
// form needs ("Site Visit", "Video-Call", ...). Not one of the categories
// seeded yet in public.dropdown (see schemaMapping.js) — falls back to a
// small hardcoded list, same "empty until seeded" convention used
// elsewhere (e.g. Ticket-and-Enquiry.jsx's Call-type fallback), so seeding
// category='installation_service_type' via Master > Dropdown later just
// works without a code change.
const SERVICE_TYPE_FALLBACK = ["Site Visit", "Video-Call", "On-Site"];

// Master data for the page: dropdown values, engineer names and service types (loaded on mount) and
// the Lead-To-Order client master. The client master is large (3000+ rows, fetched in chunks past
// the 1000-row cap), so it loads the first time ensureCompanies() is called (an enquiry form or a
// follow-up is about to open). `masterData` keeps the shape the forms already use, including the
// "Company Name" / "BILLING ADDRESS" / "GST No." parallel arrays.
export function useInstallationMasters() {
  const { toast } = useToast();
  const [baseMaster, setBaseMaster] = useState({});
  const [companies, setCompanies] = useState([]);
  const [employeeNames, setEmployeeNames] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);

  // Dropdown categories mirror src/pages/Ticket-and-Enquiry/Ticket-and-Enquiry.jsx's
  // DROPDOWN_CATEGORY_TO_KEY exactly (same public.dropdown table, same
  // display keys) so the New Enquiry form below — copied from that page —
  // needs no changes.
  const DROPDOWN_CATEGORY_TO_KEY = {
    call_type: "Call type",
    source_of_enquiry: "Source of enquiry",
    enquiry_receiver_name: "Enquiry Receiver Name",
    category: "Category",
    sub_category: "Sub-Category",
    enquiry_type: "Enquiry Type",
    service_location: "Service Location",
    machine_name: "Machine Name",
    installation_service_type: "__service_type__",
  };

  const fetchDropdownData = async () => {
    try {
      const [dropdownRows, engineerNames] = await Promise.all([
        fetchDropdownRows(Object.keys(DROPDOWN_CATEGORY_TO_KEY)),
        fetchEngineerNames(),
      ]);

      const structuredData = {};
      const serviceTypeValues = [];
      (dropdownRows || []).forEach(({ category, value }) => {
        const key = DROPDOWN_CATEGORY_TO_KEY[category];
        if (!key) return;
        if (key === "__service_type__") {
          serviceTypeValues.push(value);
          return;
        }
        if (!structuredData[key]) structuredData[key] = [];
        structuredData[key].push(value);
      });

      // Engineer names now come from Master > Engineer Contacts, not the
      // old 'engineer_assign_name' dropdown category — see engineers.js.
      structuredData["Engineer Assign Name"] = engineerNames;

      setBaseMaster(structuredData);
      setEmployeeNames(engineerNames);
      setServiceTypes(
        serviceTypeValues.filter(Boolean).length > 0
          ? [...new Set(serviceTypeValues.filter(Boolean))]
          : SERVICE_TYPE_FALLBACK
      );
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
      toast({ title: "Error", description: "Failed to load dropdown data", variant: "destructive" });
    }
  };

  const companiesRequested = useRef(false);
  const ensureCompanies = async () => {
    if (companiesRequested.current) return;
    companiesRequested.current = true;
    try {
      const { data, error } = await fetchAllRows(() =>
        ltoSupabase
          .from("lto_client_master")
          .select("company_name, billing_address, gst_number")
          .order("company_name", { ascending: true })
          .order("gst_number", { ascending: true })
      );
      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      companiesRequested.current = false;
      console.error("Error fetching company details:", error);
      toast({ title: "Error", description: "Failed to load company details", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchDropdownData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const masterData = useMemo(
    () => [
      {
        ...baseMaster,
        "Company Name": companies.map((c) => c.company_name || ""),
        "BILLING ADDRESS": companies.map((c) => c.billing_address || ""),
        "GST No.": companies.map((c) => c.gst_number || ""),
      },
    ],
    [baseMaster, companies]
  );

  return { masterData, employeeNames, serviceTypes, ensureCompanies };
}
