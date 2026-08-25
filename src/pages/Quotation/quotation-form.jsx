"use client"

import { useState, useEffect } from "react"
import QuotationDetails from "./quotation-details"
import ConsignorDetails from "./consignor-details"
import ConsigneeDetails from "./consignee-details"
import ItemsTable from "./items-table"
import TermsAndConditions from "./terms and conditions"
import BankDetails from "./bank-details"
import NotesSection from "./notes-section"
import SpecialOfferSection from "./special-offer-section"
import { getCompanyPrefix, getNextQuotationNumber } from "./quotation-service"

const QuotationForm = ({
  quotationData,
  handleInputChange,
  handleItemChange,
  handleFlatDiscountChange,
  handleAddItem,
  handleNoteChange,
  addNote,
  removeNote,
  hiddenFields,
  toggleFieldVisibility,
  isRevising,
  existingQuotations,
  selectedQuotation,
  handleSpecialDiscountChange,
  handleQuotationSelect,
  isLoadingQuotation,
  specialDiscount,
  setSpecialDiscount,
  selectedReferences,
  setSelectedReferences,
  imageform,
  addSpecialOffer,
  removeSpecialOffer,
  handleSpecialOfferChange,
  setQuotationData, // ADD THIS LINE
  hiddenColumns,    // ADD THIS LINE
  setHiddenColumns, // ADD THIS LINE
}) => {
  const [dropdownData, setDropdownData] = useState({})
  const [stateOptions, setStateOptions] = useState(["Select State"])
  const [companyOptions, setCompanyOptions] = useState(["Select Company"])
  const [referenceOptions, setReferenceOptions] = useState(["Select Reference"])
  const [preparedByOptions, setPreparedByOptions] = useState([""])
  const [productCodes, setProductCodes] = useState([])
  const [productNames, setProductNames] = useState([])
  const [productData, setProductData] = useState({})
  const [isItemsLoading, setIsItemsLoading] = useState(false);

  // NEW: Lead number states
  const [showLeadNoDropdown, setShowLeadNoDropdown] = useState(false)
  const [leadNoOptions, setLeadNoOptions] = useState(["Select Lead No."])
  const [leadNoData, setLeadNoData] = useState({})

  // Fetch dropdown data for states and corresponding details
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const dropdownUrl =
          `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=DROPDOWN`
        const dropdownResponse = await fetch(dropdownUrl)
        const dropdownText = await dropdownResponse.text()

        const dropdownJsonStart = dropdownText.indexOf("{")
        const dropdownJsonEnd = dropdownText.lastIndexOf("}") + 1
        const dropdownJsonData = dropdownText.substring(dropdownJsonStart, dropdownJsonEnd)

        const dropdownData = JSON.parse(dropdownJsonData)

        if (dropdownData && dropdownData.table && dropdownData.table.rows) {
          const stateOptionsData = ["Select State"]
          const stateDetailsMap = {}
          const preparedByOptionsData = [""]
          const companyOptionsData = ["Select Company"]
          const companyDetailsMap = {}
          const referenceOptionsData = ["Select Reference"]
          const referenceDetailsMap = {}

          dropdownData.table.rows.slice(0).forEach((row) => {
            if (row.c) {
              const preparedByName = row.c[79] ? row.c[79].v : ""
              if (preparedByName && !preparedByOptionsData.includes(preparedByName)) {
                preparedByOptionsData.push(preparedByName)
              }

              const stateName = row.c[26] ? row.c[26].v : ""
              if (stateName && !stateOptionsData.includes(stateName)) {
                stateOptionsData.push(stateName)

                let bankDetails = ""
                if (row.c[27] && row.c[27].v) {
                  bankDetails = row.c[27].v
                }

                const pan = row.c[25] ? row.c[25].v : ""
                const msmeNumber = row.c[33] ? row.c[33].v : ""

                stateDetailsMap[stateName] = {
                  bankDetails: bankDetails,
                  consignerAddress: row.c[28] ? row.c[28].v : "",
                  stateCode: row.c[30] ? row.c[30].v : "",
                  gstin: row.c[31] ? row.c[31].v : "",
                  pan: pan,
                  msmeNumber: msmeNumber,
                }
              }

              const companyName = row.c[12] ? row.c[12].v : ""
              if (companyName && !companyOptionsData.includes(companyName)) {
                companyOptionsData.push(companyName)

                companyDetailsMap[companyName] = {
                  address: row.c[15] ? row.c[15].v : "",
                  state: row.c[16] ? row.c[16].v : "",
                  contactName: row.c[13] ? row.c[13].v : "",
                  contactNo: row.c[14] ? row.c[14].v : "",
                  gstin: row.c[17] ? row.c[17].v : "",
                  stateCode: row.c[18] ? row.c[18].v : "",
                }
              }

              const referenceName = row.c[21] ? row.c[21].v : ""
              if (referenceName && !referenceOptionsData.includes(referenceName)) {
                referenceOptionsData.push(referenceName)

                referenceDetailsMap[referenceName] = {
                  mobile: row.c[22] ? row.c[22].v : "",
                  phone: row.c[83] ? row.c[83].v : "",
                }
              }
            }
          })

          setStateOptions(stateOptionsData)
          setCompanyOptions(companyOptionsData)
          setReferenceOptions(referenceOptionsData)
          setPreparedByOptions(preparedByOptionsData)

          setDropdownData({
            states: stateDetailsMap,
            companies: companyDetailsMap,
            references: referenceDetailsMap,
          })
        }
      } catch (error) {
        console.error("Error fetching dropdown data:", error)

        setStateOptions(["Select State", "Chhattisgarh", "Maharashtra", "Delhi"])
        setCompanyOptions(["Select Company", "ABC Corp", "XYZ Industries", "PQR Ltd"])
        setReferenceOptions(["Select Reference", "John Doe", "Jane Smith", "Mike Johnson"])

        setDropdownData({
          states: {
            Chhattisgarh: {
              bankDetails:
                "Account No.: 438605000447\nBank Name: ICICI BANK\nBank Address: FAFADIH, RAIPUR\nIFSC CODE: ICIC0004386\nEmail: Support@thedivineempire.com\nWebsite: www.thedivineempire.com",
              consignerAddress: "Divine Empire Private Limited, Raipur, Chhattisgarh",
              stateCode: "22",
              gstin: "22AAKCD1234M1Z5",
            },
          },
          companies: {
            "ABC Corp": {
              address: "123 Main Street, Mumbai, Maharashtra",
              state: "Maharashtra",
              contactName: "Rajesh Kumar",
              contactNo: "9876543210",
              gstin: "27ABCDE1234F1Z5",
              stateCode: "27",
            },
          },
          references: {
            "John Doe": {
              mobile: "9898989898",
            },
          },
        })
      }
    }

    fetchDropdownData()
  }, [])

  // NEW: Fetch lead numbers from both sheets with filtering conditions
  useEffect(() => {
    const fetchLeadNumbers = async () => {
      try {
        const leadNoOptionsData = ["Select Lead No."]
        const leadNoDataMap = {}

        // Fetch from FMS sheet
        const fmsUrl =
          `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=Ticket_Enquiry`
        const fmsResponse = await fetch(fmsUrl)
        const fmsText = await fmsResponse.text()

        const fmsJsonStart = fmsText.indexOf("{")
        const fmsJsonEnd = fmsText.lastIndexOf("}") + 1
        const fmsJsonData = fmsText.substring(fmsJsonStart, fmsJsonEnd)
        const fmsData = JSON.parse(fmsJsonData)

        if (fmsData && fmsData.table && fmsData.table.rows) {
          fmsData.table.rows.forEach((row) => {
            if (row.c && row.c[1]) {
              // Column B (index 1)
              const leadNo = safeToString(row.c[1].v)

              // Check filtering conditions: BA (index 52) is not null and BB (index 53) is null
              const baValue = row.c[52] ? safeToString(row.c[52].v) : ""
              const bbValue = row.c[53] ? safeToString(row.c[53].v) : ""

              if (leadNo && !leadNoOptionsData.includes(leadNo) && baValue !== "" && bbValue === "") {
                leadNoOptionsData.push(leadNo)

                leadNoDataMap[leadNo] = {
                  sheet: "FMS",
                  companyName: row.c[23] ? safeToString(row.c[23].v) : "", // Column D
                  address: row.c[24] ? safeToString(row.c[24].v) : "", // Column G
                  state: row.c[26] ? safeToString(row.c[26].v) : "", // Column N
                  contactName: row.c[2] ? safeToString(row.c[2].v) : "", // Column F
                  contactNo: row.c[3] ? safeToString(row.c[3].v) : "", // Column E
                  gstin: row.c[27] ? safeToString(row.c[27].v) : "", // Column L
                  shipTo: row.c[25] ? safeToString(row.c[25].v) : "", // Column I
                  rowData: row.c, // Store full row data for items
                }
              }
            }
          })
        }

        // Fetch from ENQUIRY TO ORDER sheet
        const enquiryUrl =
          `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=Ticket_Enquiry`

        const enquiryResponse = await fetch(enquiryUrl)
        const enquiryText = await enquiryResponse.text()

        const enquiryJsonStart = enquiryText.indexOf("{")
        const enquiryJsonEnd = enquiryText.lastIndexOf("}") + 1
        const enquiryJsonData = enquiryText.substring(enquiryJsonStart, enquiryJsonEnd)
        const enquiryData = JSON.parse(enquiryJsonData)

        if (enquiryData && enquiryData.table && enquiryData.table.rows) {
          enquiryData.table.rows.slice(4).forEach((row) => {
            if (row.c && row.c[1]) {
              // Column B (index 1)
              const leadNo = safeToString(row.c[1].v)

              // Check filtering conditions: AL (index 37) is not null and AM (index 38) is null
              const alValue = row.c[37] ? safeToString(row.c[37].v) : ""
              const amValue = row.c[38] ? safeToString(row.c[38].v) : ""

              if (leadNo && !leadNoOptionsData.includes(leadNo)) {
                leadNoOptionsData.push(leadNo)

                leadNoDataMap[leadNo] = {
                  sheet: "ENQUIRY",
                  // companyName: row.c[3] ? safeToString(row.c[3].v) : "", // Column D
                  // address: row.c[6] ? safeToString(row.c[6].v) : "", // Column G
                  // state: row.c[13] ? safeToString(row.c[13].v) : "", // Column N
                  // contactName: row.c[5] ? safeToString(row.c[5].v) : "", // Column F
                  // contactNo: row.c[4] ? safeToString(row.c[4].v) : "", // Column E
                  // gstin: row.c[11] ? safeToString(row.c[11].v) : "", // Column L
                  // shipTo: row.c[8] ? safeToString(row.c[8].v) : "", // Column I
                  // rowData: row.c, // Store full row data for items



                  companyName: row.c[23] ? safeToString(row.c[23].v) : "", // Column D
                  address: row.c[24] ? safeToString(row.c[24].v) : "", // Column G
                  state: row.c[26] ? safeToString(row.c[26].v) : "", // Column N
                  contactName: row.c[2] ? safeToString(row.c[2].v) : "", // Column F
                  contactNo: row.c[3] ? safeToString(row.c[3].v) : "", // Column E
                  gstin: row.c[27] ? safeToString(row.c[27].v) : "", // Column L
                  shipTo: row.c[25] ? safeToString(row.c[25].v) : "", // Column I
                  rowData: row.c, // Store full row data for items
                }
              }
            }
          })
        }

        setLeadNoOptions(leadNoOptionsData)
        setLeadNoData(leadNoDataMap)
      } catch (error) {
        console.error("Error fetching lead numbers:", error)
      }
    }

    fetchLeadNumbers()
  }, [])

  const handleSpecialDiscountChangeWrapper = (value) => {
    const discount = Number(value) || 0
    setSpecialDiscount(discount)
    handleSpecialDiscountChange(discount)
  }

  useEffect(() => {
    const fetchProductData = async () => {
      try {
        const dropdownUrl =
          `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=DROPDOWN`
        const response = await fetch(dropdownUrl)
        const text = await response.text()

        const jsonStart = text.indexOf("{")
        const jsonEnd = text.lastIndexOf("}") + 1
        const jsonData = JSON.parse(text.substring(jsonStart, jsonEnd))

        const codes = ["Select Code"]
        const names = ["Select Product"]
        const productDataMap = {}

        if (jsonData && jsonData.table && jsonData.table.rows) {
          jsonData.table.rows.forEach((row) => {
            if (row.c && row.c[60] && row.c[62]) {
              const code = row.c[60].v
              const name = row.c[62].v
              const description = row.c[78] ? row.c[78].v : ""
              const rate = row.c[77] ? row.c[77].v : 0

              if (code && !codes.includes(code)) {
                codes.push(code)
              }

              if (name && !names.includes(name)) {
                names.push(name)
              }

              productDataMap[code] = {
                name: name,
                description: description,
                rate: rate,
              }

              productDataMap[name] = {
                code: code,
                description: description,
                rate: rate,
              }
            }
          })
        }

        setProductCodes(codes)
        setProductNames(names)
        setProductData(productDataMap)
      } catch (error) {
        console.error("Error fetching product data:", error)
        setProductCodes(["Select Code", "CODE1", "CODE2", "CODE3"])
        setProductNames(["Select Product", "Product 1", "Product 2", "Product 3"])
        setProductData({
          CODE1: { name: "Product 1", description: "Description 1", rate: 100 },
          "Product 1": { code: "CODE1", description: "Description 1", rate: 100 },
        })
      }
    }

    fetchProductData()
  }, [])

  // Function to handle quotation number updates
  const handleQuotationNumberUpdate = (newQuotationNumber) => {
    handleInputChange("quotationNo", newQuotationNumber)
  }

  // Helper function to safely convert value to string
  const safeToString = (value) => {
    if (value === null || value === undefined) return ""
    return String(value)
  }

  // NEW: Handle lead number selection and autofill
  const handleLeadNoSelect = async (selectedLeadNo) => {
    if (!selectedLeadNo || selectedLeadNo === "Select Lead No." || !leadNoData[selectedLeadNo]) {
      return;
    }

    setIsItemsLoading(true); // Start loading

    const leadData = leadNoData[selectedLeadNo]

    // Fill consignee details
    const companyName = leadData.companyName
    handleInputChange("consigneeName", companyName)
    handleInputChange("consigneeAddress", leadData.address)
    handleInputChange("consigneeState", leadData.state)
    handleInputChange("consigneeContactName", leadData.contactName)
    handleInputChange("consigneeContactNo", leadData.contactNo)
    handleInputChange("consigneeGSTIN", leadData.gstin)

    if (leadData.shipTo) {
      handleInputChange("shipTo", leadData.shipTo)
    }

    // IMPORTANT: Fill additional company details from dropdown data if available
    if (companyName && dropdownData.companies && dropdownData.companies[companyName]) {
      const companyDetails = dropdownData.companies[companyName]

      // Fill additional company details if not already filled from lead data
      if (!leadData.address && companyDetails.address) {
        handleInputChange("consigneeAddress", companyDetails.address)
      }
      if (!leadData.state && companyDetails.state) {
        handleInputChange("consigneeState", companyDetails.state)
      }
      if (!leadData.contactName && companyDetails.contactName) {
        handleInputChange("consigneeContactName", companyDetails.contactName)
      }
      if (!leadData.contactNo && companyDetails.contactNo) {
        handleInputChange("consigneeContactNo", companyDetails.contactNo)
      }
      if (!leadData.gstin && companyDetails.gstin) {
        handleInputChange("consigneeGSTIN", companyDetails.gstin)
      }
      if (companyDetails.stateCode) {
        handleInputChange("consigneeStateCode", companyDetails.stateCode)
      }
    }

    // CRITICAL: Get company prefix and update quotation number based on company name
    try {
      // const companyPrefix = await getCompanyPrefix(companyName)
      // const newQuotationNumber = await getNextQuotationNumber(companyPrefix)

      // handleInputChange("quotationNo", newQuotationNumber)



      const companyPrefix = await getCompanyPrefix(companyName)

      // NEW: Use the new function
      const scriptUrl = import.meta.env.VITE_APPS_SCRIPT_API
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "getNextQuotationNumberNew",
          companyPrefix: companyPrefix
        }),
      })

      const result = await response.json()
      if (result.success) {
        handleInputChange("quotationNo", result.nextQuotationNumber)
      }


    } catch (error) {
      console.error("Error updating quotation number from lead selection:", error)
    }

    // Auto-fill items using the local handleAutoFillItems function
    try {
      await handleAutoFillItems(companyName)
    } catch (error) {
      console.error("Error auto-filling items:", error)
    }

    // Wait a bit to ensure productData is available
    await new Promise(resolve => setTimeout(resolve, 100))

    // Auto-fill items based on sheet data
    const autoItems = []

    if (leadData.sheet === "FMS") {
      const row = leadData.rowData
      const baValue = row[52] ? safeToString(row[52].v) : ""
      const bbValue = row[53] ? safeToString(row[53].v) : ""
      const biValue = row[60] ? safeToString(row[60].v) : ""


      if (baValue !== "" && biValue === "") {

        // Regular columns AN-AW (indices 39-48)
        const itemColumns = [
          { nameCol: 39, qtyCol: 40 }, // AN, AO
          { nameCol: 41, qtyCol: 42 }, // AP, AQ
          { nameCol: 43, qtyCol: 44 }, // AR, AS
          { nameCol: 45, qtyCol: 46 }, // AT, AU
          { nameCol: 47, qtyCol: 48 }, // AV, AW
        ]

        for (const { nameCol, qtyCol } of itemColumns) {
          const itemName = row[nameCol] ? safeToString(row[nameCol].v).trim() : ""
          const itemQty = row[qtyCol] ? safeToString(row[qtyCol].v) : ""


          if (itemName !== "" && itemQty !== "") {
            const qty = isNaN(Number(itemQty)) ? 1 : Number(itemQty)
            autoItems.push({
              name: itemName,
              qty: qty,
            })
          }
        }

        // JSON data from CS column (index 96)
        const csValue = row[96] ? safeToString(row[96].v) : ""

        if (csValue !== "" && csValue !== "null" && csValue !== "undefined") {
          try {
            const jsonData = JSON.parse(csValue)
            if (Array.isArray(jsonData)) {
              jsonData.forEach((item) => {
                if (item.name && item.quantity !== undefined && item.quantity !== null) {
                  const qty = isNaN(Number(item.quantity)) ? 1 : Number(item.quantity)
                  autoItems.push({
                    name: item.name,
                    qty: qty,
                  })
                }
              })
            }
          } catch (error) {
            console.error("Error parsing JSON data from FMS:", error)
          }
        }
      } else {
        console.log("FMS lead conditions not met - BA:", baValue, "BI:", biValue)
      }
    } else if (leadData.sheet === "ENQUIRY") {
      const row = leadData.rowData
      const alValue = row[37] ? safeToString(row[37].v) : ""
      const amValue = row[38] ? safeToString(row[38].v) : ""
      const atValue = row[45] ? safeToString(row[45].v) : ""


      if (alValue !== "" && amValue === "") {

        // FIRST: Process regular columns R-AK (indices 17-36) - 10 items
        const itemColumns = [
          { nameCol: 17, qtyCol: 18 }, // R, S
          { nameCol: 19, qtyCol: 20 }, // T, U
          { nameCol: 21, qtyCol: 22 }, // V, W
          { nameCol: 23, qtyCol: 24 }, // X, Y
          { nameCol: 25, qtyCol: 26 }, // Z, AA
          { nameCol: 27, qtyCol: 28 }, // AB, AC
          { nameCol: 29, qtyCol: 30 }, // AD, AE
          { nameCol: 31, qtyCol: 32 }, // AF, AG
          { nameCol: 33, qtyCol: 34 }, // AH, AI
          { nameCol: 35, qtyCol: 36 }, // AJ, AK
        ]
        for (const { nameCol, qtyCol } of itemColumns) {
          const itemName = row[nameCol] ? safeToString(row[nameCol].v).trim() : ""
          const itemQty = row[qtyCol] ? safeToString(row[qtyCol].v) : ""


          if (itemName !== "" && itemQty !== "") {
            const qty = isNaN(Number(itemQty)) ? 1 : Number(itemQty)
            autoItems.push({
              name: itemName,
              qty: qty,
            })
          }
        }


        // SECOND: Process JSON data from CB column (index 79) - Continue from item 11+
        const cbValue = row[79] ? safeToString(row[79].v) : ""

        if (cbValue !== "" && cbValue !== "null" && cbValue !== "undefined") {
          try {
            const jsonData = JSON.parse(cbValue)

            if (Array.isArray(jsonData)) {
              jsonData.forEach((item, index) => {
                if (item.name && item.quantity !== undefined && item.quantity !== null) {
                  const qty = isNaN(Number(item.quantity)) ? 1 : Number(item.quantity)
                  autoItems.push({
                    name: item.name,
                    qty: qty,
                  })
                }
              })
            }
          } catch (error) {
            console.error("Error parsing JSON data from ENQUIRY CB column:", error)
          }
        }

      }
    }

    // Update items if found from lead data
    if (autoItems.length > 0) {

      const newItems = autoItems.map((item, index) => {
        // Auto-fill product code from productData with better matching
        let productInfo = null
        let productCode = ""
        let productDescription = ""
        let productRate = 0

        // Try exact match first
        if (productData[item.name]) {
          productInfo = productData[item.name]
        } else {
          // Try case-insensitive match
          const matchingKey = Object.keys(productData).find(key =>
            key.toLowerCase().trim() === item.name.toLowerCase().trim()
          )
          if (matchingKey) {
            productInfo = productData[matchingKey]
          }
        }

        if (productInfo) {
          productCode = productInfo.code || ""
          productDescription = productInfo.description || ""
          productRate = productInfo.rate || 0
        }


        // If no code found, try a partial match
        if (!productCode) {
          const partialMatch = Object.keys(productData).find(key =>
            key.toLowerCase().includes(item.name.toLowerCase().substring(0, 10)) ||
            item.name.toLowerCase().includes(key.toLowerCase().substring(0, 10))
          )
          if (partialMatch && productData[partialMatch]) {
            productCode = productData[partialMatch].code || ""
            productDescription = productData[partialMatch].description || ""
            productRate = productData[partialMatch].rate || 0
          }
        }

        return {
          id: index + 1,
          code: productCode, // Auto-filled from productData
          name: item.name,
          description: productDescription, // Auto-filled from productData
          gst: 18,
          qty: item.qty,
          units: "Nos",
          rate: productRate, // Auto-filled from productData
          discount: 0,
          flatDiscount: 0,
          amount: item.qty * productRate, // Calculate initial amount
        }
      })

      handleInputChange("items", newItems)
    }

    setIsItemsLoading(false); // Stop loading
  }

  // Function to auto-fill items based on company selection
  const handleAutoFillItems = async (companyName) => {
    if (!companyName || companyName === "Select Company") return

    try {

      // First try FMS sheet
      const fmsUrl =
        `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=FMS`
      const fmsResponse = await fetch(fmsUrl)
      const fmsText = await fmsResponse.text()

      const fmsJsonStart = fmsText.indexOf("{")
      const fmsJsonEnd = fmsText.lastIndexOf("}") + 1
      const fmsJsonData = fmsText.substring(fmsJsonStart, fmsJsonEnd)
      const fmsData = JSON.parse(fmsJsonData)

      let itemsFound = false
      const autoItems = []

      // Check FMS sheet first
      if (fmsData && fmsData.table && fmsData.table.rows) {
        for (const row of fmsData.table.rows) {
          if (row.c && row.c[4]) {
            // Column E (index 4) - Project Name
            const rowCompanyName = safeToString(row.c[4].v)

            if (rowCompanyName && rowCompanyName.toLowerCase().trim() === companyName.toLowerCase().trim()) {
              // Check if BA (index 52) is not null and BI (index 60) is null
              const baValue = row.c[52] ? safeToString(row.c[52].v) : ""
              const biValue = row.c[60] ? safeToString(row.c[60].v) : ""


              if (baValue !== "" && biValue === "") {

                // FIRST: Extract items from regular columns (AN to AW)
                const itemColumns = [
                  { nameCol: 39, qtyCol: 40 }, // AN (Item Name1), AO (Quantity1)
                  { nameCol: 41, qtyCol: 42 }, // AP (Item Name2), AQ (Quantity2)
                  { nameCol: 43, qtyCol: 44 }, // AR (Item Name3), AS (Quantity3)
                  { nameCol: 45, qtyCol: 46 }, // AT (Item Name4), AU (Quantity4)
                  { nameCol: 47, qtyCol: 48 }, // AV (Item Name5), AW (Quantity5)
                ]

                for (const { nameCol, qtyCol } of itemColumns) {
                  const itemName = row.c[nameCol] ? safeToString(row.c[nameCol].v).trim() : ""
                  const itemQty = row.c[qtyCol] ? safeToString(row.c[qtyCol].v) : ""


                  if (itemName !== "" && itemQty !== "") {
                    // Fix: Preserve 0 quantities, only use fallback for invalid numbers
                    const qty = isNaN(Number(itemQty)) ? 1 : Number(itemQty)
                    autoItems.push({
                      name: itemName,
                      qty: qty,
                    })
                  }
                }

                const csValue = row.c[96] ? safeToString(row.c[96].v) : ""

                if (csValue !== "") {
                  try {
                    // Parse JSON data from CS column
                    const jsonData = JSON.parse(csValue)

                    if (Array.isArray(jsonData)) {
                      jsonData.forEach((item) => {
                        if (item.name && item.quantity !== undefined && item.quantity !== null) {
                          // Fix: Preserve 0 quantities, only use fallback for invalid numbers
                          const qty = isNaN(Number(item.quantity)) ? 1 : Number(item.quantity)
                          autoItems.push({
                            name: item.name,
                            qty: qty,
                          })
                        }
                      })
                    }
                  } catch (jsonError) {
                    console.error("Error parsing JSON from CS column:", jsonError)
                  }
                }

                itemsFound = true
                break
              }
            }
          }
        }
      }

      // If not found in FMS, try ENQUIRY TO ORDER sheet
      if (!itemsFound) {

        const enquiryUrl =
          `https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json&sheet=ENQUIRY%20TO%20ORDER`
        const enquiryResponse = await fetch(enquiryUrl)
        const enquiryText = await enquiryResponse.text()

        const enquiryJsonStart = enquiryText.indexOf("{")
        const enquiryJsonEnd = enquiryText.lastIndexOf("}") + 1
        const enquiryJsonData = enquiryText.substring(enquiryJsonStart, enquiryJsonEnd)
        const enquiryData = JSON.parse(enquiryJsonData)

        if (enquiryData && enquiryData.table && enquiryData.table.rows) {
          for (const row of enquiryData.table.rows) {
            if (row.c && row.c[3]) {
              // Column D (index 3)
              const rowCompanyName = safeToString(row.c[3].v)
              if (rowCompanyName && rowCompanyName.toLowerCase().trim() === companyName.toLowerCase().trim()) {
                // Check if AL (index 37) is not null and AT (index 45) is null
                const alValue = row.c[37] ? safeToString(row.c[37].v) : ""
                const atValue = row.c[45] ? safeToString(row.c[45].v) : ""

                if (alValue !== "" && atValue === "") {

                  // Extract items from R to AK (columns 17-36)
                  const itemColumns = [
                    { nameCol: 17, qtyCol: 18 }, // R (Item Name1), S (Quantity1)
                    { nameCol: 19, qtyCol: 20 }, // T (Item Name2), U (Quantity2)
                    { nameCol: 21, qtyCol: 22 }, // V (Item Name3), W (Quantity3)
                    { nameCol: 23, qtyCol: 24 }, // X (Item Name4), Y (Quantity4)
                    { nameCol: 25, qtyCol: 26 }, // Z (Item Name5), AA (Quantity5)
                    { nameCol: 27, qtyCol: 28 }, // AB (Item Name6), AC (Quantity6)
                    { nameCol: 29, qtyCol: 30 }, // AD (Item Name7), AE (Quantity7)
                    { nameCol: 31, qtyCol: 32 }, // AF (Item Name8), AG (Quantity8)
                    { nameCol: 33, qtyCol: 34 }, // AH (Item Name9), AI (Quantity9)
                    { nameCol: 35, qtyCol: 36 }, // AJ (Item Name10), AK (Quantity10)
                  ]

                  for (const { nameCol, qtyCol } of itemColumns) {
                    const itemName = row.c[nameCol] ? safeToString(row.c[nameCol].v).trim() : ""
                    const itemQty = row.c[qtyCol] ? safeToString(row.c[qtyCol].v) : ""

                    if (itemName !== "" && itemQty !== "") {
                      // Fix: Preserve 0 quantities, only use fallback for invalid numbers
                      const qty = isNaN(Number(itemQty)) ? 1 : Number(itemQty)
                      autoItems.push({
                        name: itemName,
                        qty: qty,
                      })
                    }
                  }

                  // ALSO: Check for JSON data in CB column (index 55) for ENQUIRY TO ORDER
                  const cbValue = row.c[55] ? safeToString(row.c[55].v) : ""

                  if (cbValue !== "") {
                    try {
                      // Parse JSON data from CB column
                      const jsonData = JSON.parse(cbValue)

                      if (Array.isArray(jsonData)) {
                        jsonData.forEach((item) => {
                          if (item.name && item.quantity !== undefined && item.quantity !== null) {
                            // Fix: Preserve 0 quantities, only use fallback for invalid numbers
                            const qty = isNaN(Number(item.quantity)) ? 1 : Number(item.quantity)
                            autoItems.push({
                              name: item.name,
                              qty: qty,
                            })
                          }
                        })
                      }
                    } catch (jsonError) {
                      console.error("Error parsing JSON from CB column:", jsonError)
                    }
                  }

                  itemsFound = true
                  break
                }
              }
            }
          }
        }
      }

      // If items found, auto-fill the quotation table
      if (itemsFound && autoItems.length > 0) {

        // Clear existing items and add new ones
        const newItems = autoItems.map((item, index) => {
          // Look up the product code from productData
          const productInfo = productData[item.name]
          const productCode = productInfo ? productInfo.code : ""

          return {
            id: index + 1,
            code: productCode, // Auto-fill the code from productData
            name: item.name,
            description: "",
            gst: 18,
            qty: item.qty,
            units: "Nos",
            rate: 0,
            discount: 0,
            flatDiscount: 0,
            amount: 0,
          }
        })

        // Update quotation data with new items
        handleInputChange("items", newItems)

      }
    } catch (error) {
      console.error("Error auto-filling items:", error)
    } finally {
      setIsItemsLoading(false); // Stop loading regardless of success/failure
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <QuotationDetails
            quotationData={quotationData}
            handleInputChange={handleInputChange}
            isRevising={isRevising}
            existingQuotations={existingQuotations}
            selectedQuotation={selectedQuotation}
            handleQuotationSelect={handleQuotationSelect}
            isLoadingQuotation={isLoadingQuotation}
            preparedByOptions={preparedByOptions}
            stateOptions={stateOptions}
            dropdownData={dropdownData}
          />

          <ConsignorDetails
            quotationData={quotationData}
            handleInputChange={handleInputChange}
            referenceOptions={referenceOptions}
            selectedReferences={selectedReferences}
            setSelectedReferences={setSelectedReferences}
            dropdownData={dropdownData}
          />
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <ConsigneeDetails
            quotationData={quotationData}
            handleInputChange={handleInputChange}
            companyOptions={companyOptions}
            dropdownData={dropdownData}
            onQuotationNumberUpdate={handleQuotationNumberUpdate}
            onAutoFillItems={handleAutoFillItems}
            showLeadNoDropdown={showLeadNoDropdown}
            setShowLeadNoDropdown={setShowLeadNoDropdown}
            leadNoOptions={leadNoOptions}
            handleLeadNoSelect={handleLeadNoSelect}
          />
        </div>
      </div>

      <ItemsTable
        quotationData={quotationData}
        handleItemChange={handleItemChange}
        handleAddItem={handleAddItem}
        handleSpecialDiscountChange={handleSpecialDiscountChangeWrapper}
        specialDiscount={specialDiscount}
        setSpecialDiscount={setSpecialDiscount}
        productCodes={productCodes}
        productNames={productNames}
        productData={productData}
        setQuotationData={setQuotationData}
        isLoading={isItemsLoading}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
      />

      <TermsAndConditions
        quotationData={quotationData}
        handleInputChange={handleInputChange}
        hiddenFields={hiddenFields}
        toggleFieldVisibility={toggleFieldVisibility}
      />

      <SpecialOfferSection
        quotationData={quotationData}
        handleInputChange={handleInputChange}
        addSpecialOffer={addSpecialOffer}
        removeSpecialOffer={removeSpecialOffer}
        handleSpecialOfferChange={handleSpecialOfferChange}
      />

      <NotesSection
        quotationData={quotationData}
        handleNoteChange={handleNoteChange}
        addNote={addNote}
        removeNote={removeNote}
      />

      <BankDetails quotationData={quotationData} handleInputChange={handleInputChange} imageform={imageform} />
    </div>
  )
}

export default QuotationForm