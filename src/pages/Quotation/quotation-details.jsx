"use client"

const QuotationDetails = ({
  quotationData,
  handleInputChange,
  isRevising,
  existingQuotations,
  selectedQuotation,
  handleQuotationSelect,
  isLoadingQuotation,
  preparedByOptions,
  stateOptions,
  dropdownData,
}) => {
  const handleStateChange = (e) => {
    const selectedState = e.target.value
    handleInputChange("consignorState", selectedState)

    if (selectedState && dropdownData.states && dropdownData.states[selectedState]) {
      const stateDetails = dropdownData.states[selectedState]

      if (stateDetails.bankDetails) {
        const bankDetailsText = stateDetails.bankDetails

        const accountNoMatch = bankDetailsText.match(/Account No\.: ([^\n]+)/)
        const bankNameMatch = bankDetailsText.match(/Bank Name: ([^\n]+)/)
        const bankAddressMatch = bankDetailsText.match(/Bank Address: ([^\n]+)/)
        const ifscMatch = bankDetailsText.match(/IFSC CODE: ([^\n]+)/)
        const emailMatch = bankDetailsText.match(/Email: ([^\n]+)/)
        const websiteMatch = bankDetailsText.match(/Website: ([^\n]+)/)

        if (accountNoMatch) handleInputChange("accountNo", accountNoMatch[1])
        if (bankNameMatch) handleInputChange("bankName", bankNameMatch[1])
        if (bankAddressMatch) handleInputChange("bankAddress", bankAddressMatch[1])
        if (ifscMatch) handleInputChange("ifscCode", ifscMatch[1])
        if (emailMatch) handleInputChange("email", emailMatch[1])
        if (websiteMatch) handleInputChange("website", websiteMatch[1])
      }

      if (stateDetails.consignerAddress) {
        handleInputChange("consignorAddress", stateDetails.consignerAddress)
      }

      if (stateDetails.stateCode) {
        handleInputChange("consignorStateCode", stateDetails.stateCode)
      }

      if (stateDetails.gstin) {
        handleInputChange("consignorGSTIN", stateDetails.gstin)
      }

      if (stateDetails.msmeNumber) {
        handleInputChange("msmeNumber", stateDetails.msmeNumber)
      }

      if (stateDetails.pan) {
        handleInputChange("pan", stateDetails.pan)
      }
    } else {
      handleInputChange("accountNo", "")
      handleInputChange("bankName", "")
      handleInputChange("bankAddress", "")
      handleInputChange("ifscCode", "")
      handleInputChange("email", "")
      handleInputChange("website", "")
      handleInputChange("pan", "")
      handleInputChange("consignorAddress", "")
      handleInputChange("consignorStateCode", "")
      handleInputChange("consignorGSTIN", "")
      handleInputChange("msmeNumber", "")
    }
  }

  return (
    <>
      <h3 className="text-lg font-medium mb-4">Quotation Details</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Quotation No.</label>
            {isRevising ? (
              <div className="flex items-center">
                <select
                  value={selectedQuotation}
                  onChange={(e) => handleQuotationSelect(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select Quotation to Revise</option>
                  {existingQuotations && existingQuotations.length > 0 ? (
                    existingQuotations.map((quotation, index) => (
                      <option key={`${quotation}-${index}`} value={quotation}>
                        {quotation}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      Loading quotations...
                    </option>
                  )}
                </select>
                {isLoadingQuotation && (
                  <div className="ml-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={quotationData.quotationNo}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Date</label>
            <input
              type="date"
              value={quotationData.date.split("/").reverse().join("-")}
              onChange={(e) => {
                const dateValue = e.target.value
                if (dateValue) {
                  const [year, month, day] = dateValue.split("-")
                  handleInputChange("date", `${day}/${month}/${year}`)
                }
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Prepared By</label>
          <input
            type="text"
            list="preparedByList"
            value={quotationData.preparedBy}
            onChange={(e) => handleInputChange("preparedBy", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Enter or select the name of the person preparing this quotation"
            required
          />
          <datalist id="preparedByList">
            {preparedByOptions.map((name, idx) => (
              <option key={idx} value={name} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">State</label>
          <select
            value={quotationData.consignorState}
            onChange={handleStateChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            {stateOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  )
}

export default QuotationDetails
