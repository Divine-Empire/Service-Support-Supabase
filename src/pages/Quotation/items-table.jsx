"use client";
import { useState } from "react";
import { PlusIcon, TrashIcon } from "../../components/Icons";

const ItemsTable = ({
  quotationData,
  handleItemChange,
  handleAddItem,
  specialDiscount,
  setSpecialDiscount,
  productCodes,
  productNames,
  productData,
  setQuotationData,
  handleSpecialDiscountChange,
  isLoading,
  hiddenColumns,
  setHiddenColumns,
}) => {
  // Use props instead of local state
  const hideDisc = hiddenColumns?.hideDisc || false;
  const hideFlatDisc = hiddenColumns?.hideFlatDisc || false;
  const hideTotalFlatDisc = hiddenColumns?.hideTotalFlatDisc || false;
  const hideSpecialDiscount = hiddenColumns?.hideSpecialDiscount || false;

  const hideCode = hiddenColumns?.hideCode || false;
  const hideProductName = hiddenColumns?.hideProductName || false;
  const hideDescription = hiddenColumns?.hideDescription || false;
  const hideGST = hiddenColumns?.hideGST || false;
  const hideQty = hiddenColumns?.hideQty || false;
  const hideUnits = hiddenColumns?.hideUnits || false;
  const hideRate = hiddenColumns?.hideRate || false;
  const hideAmount = hiddenColumns?.hideAmount || false;

  const [showDropdown, setShowDropdown] = useState(false);

  const calculateColSpan = () => {
    let baseSpan = 11; // Start with max columns
    if (hideCode) baseSpan -= 1;
    if (hideProductName) baseSpan -= 1;
    if (hideDescription) baseSpan -= 1;
    if (hideGST) baseSpan -= 1;
    if (hideQty) baseSpan -= 1;
    if (hideUnits) baseSpan -= 1;
    if (hideRate) baseSpan -= 1;
    if (hideDisc) baseSpan -= 1;
    if (hideFlatDisc) baseSpan -= 1;
    if (hideAmount) baseSpan -= 1;
    return baseSpan.toString();
  };
  // Calculate taxable amount properly (subtotal - totalFlatDiscount)
  const taxableAmount = Math.max(
    0,
    quotationData.subtotal - quotationData.totalFlatDiscount
  );

  const fieldOptions = [
    { key: "hideCode", label: "Code" },
    { key: "hideProductName", label: "Product Name" },
    { key: "hideDescription", label: "Description" },
    { key: "hideGST", label: "GST %" },
    { key: "hideQty", label: "Qty." },
    { key: "hideUnits", label: "Units" },
    { key: "hideRate", label: "Rate" },
    { key: "hideDisc", label: "Disc %" },
    { key: "hideFlatDisc", label: "Flat Disc" },
    { key: "hideAmount", label: "Amount" },
    { key: "hideSubtotal", label: "Subtotal" },
    { key: "hideTotalQty", label: "Total Qty" },
    { key: "hideTotalFlatDisc", label: "Total Flat Discount" },
    { key: "hideTaxableAmount", label: "Taxable Amount" },
    { key: "hideIGST", label: "IGST" },
    { key: "hideCGST", label: "CGST" },
    { key: "hideSGST", label: "SGST" },
    { key: "hideSpecialDiscount", label: "Special Discount" },
    { key: "hideTotalDiscount", label: "Total Discount" },
    { key: "hideGrandTotal", label: "Grand Total" },
  ];

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Items</h3>
          {/* <div className="flex gap-2 flex-wrap">
            <button
              className="px-2 py-1 border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50"
              onClick={() =>
                setHiddenColumns((prev) => ({
                  ...prev,
                  hideDisc: !prev.hideDisc,
                }))
              }
            >
              {hideDisc ? "Show" : "Hide"} Disc%
            </button>
            <button
              className="px-2 py-1 border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50"
              onClick={() =>
                setHiddenColumns((prev) => ({
                  ...prev,
                  hideFlatDisc: !prev.hideFlatDisc,
                }))
              }
            >
              {hideFlatDisc ? "Show" : "Hide"} Flat Disc
            </button>
            <button
              className="px-2 py-1 border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50"
              onClick={() =>
                setHiddenColumns((prev) => ({
                  ...prev,
                  hideTotalFlatDisc: !prev.hideTotalFlatDisc,
                }))
              }
            >
              {hideTotalFlatDisc ? "Show" : "Hide"} Total Flat Disc
            </button>
            <button
              className="px-2 py-1 border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50"
              onClick={() =>
                setHiddenColumns((prev) => ({
                  ...prev,
                  hideSpecialDiscount: !prev.hideSpecialDiscount,
                }))
              }
            >
              {hideSpecialDiscount ? "Show" : "Hide"} Special Disc
            </button>
            <button
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              onClick={handleAddItem}
              disabled={isLoading}
            >
              <PlusIcon className="h-4 w-4 inline mr-1" /> Add Item
            </button>
          </div> */}

          <div className="flex gap-2 flex-wrap">
            {/* Dropdown for Hide/Show Fields */}
            <div className="relative">
              <button
                className="px-3 py-1 text-sm text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50 flex items-center gap-1"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                Hide/Show Fields
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-56 bg-white rounded-md border border-gray-300 shadow-lg max-h-96 overflow-y-auto">
                    <div className="p-2">
                      {fieldOptions.map((field) => (
                        <label
                          key={field.key}
                          className="flex items-center px-2 py-2 hover:bg-gray-50 cursor-pointer rounded"
                        >
                          <input
                            type="checkbox"
                            checked={!hiddenColumns?.[field.key]}
                            onChange={() =>
                              setHiddenColumns((prev) => ({
                                ...prev,
                                [field.key]: !prev[field.key],
                              }))
                            }
                            className="mr-3 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {field.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              onClick={handleAddItem}
              disabled={isLoading}
            >
              <PlusIcon className="h-4 w-4 inline mr-1" /> Add Item
            </button>
          </div>
        </div>

        <div className="overflow-x-auto relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
          {/* <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  S No.
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Code
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Product Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  GST %
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Qty.
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Units
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Rate
                </th>
                {!hideDisc && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Disc %
                  </th>
                )}
                {!hideFlatDisc && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Flat Disc
                  </th>
                )}
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quotationData.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">{index + 1}</td>
                  <td className="px-4 py-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={item.code}
                        onChange={(e) => {
                          handleItemChange(item.id, "code", e.target.value);
                          if (productData[e.target.value]) {
                            const productInfo = productData[e.target.value];
                            handleItemChange(item.id, "name", productInfo.name);
                            handleItemChange(
                              item.id,
                              "description",
                              productInfo.description
                            );
                            handleItemChange(item.id, "rate", productInfo.rate);
                          }
                        }}
                        list={`code-list-${item.id}`}
                        className="w-24 p-1 border border-gray-300 rounded-md"
                        disabled={isLoading}
                      />
                      <datalist id={`code-list-${item.id}`}>
                        {productCodes.map((code) => (
                          <option key={code} value={code} />
                        ))}
                      </datalist>
                    </div>
                  </td>

                  

                  <td className="px-4 py-2">
                    <div className="relative min-w-[200px]">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          handleItemChange(item.id, "name", e.target.value);
                          if (productData[e.target.value]) {
                            const productInfo = productData[e.target.value];
                            handleItemChange(item.id, "code", productInfo.code);
                            handleItemChange(
                              item.id,
                              "description",
                              productInfo.description
                            );
                            handleItemChange(item.id, "rate", productInfo.rate);
                          }
                        }}
                        list={`name-list-${item.id}`}
                        className="p-1 border border-gray-300 rounded-md"
                        style={{
                          width: `${Math.max(200, item.name.length * 8)}px`,
                        }}
                        placeholder="Enter item name"
                        disabled={isLoading}
                        required
                      />
                      <datalist id={`name-list-${item.id}`}>
                        {productNames.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                  </td>

                  

                  <td className="px-4 py-2">
                    <div className="relative min-w-[200px]">
                      <textarea
                        value={item.description || ""}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "description",
                            e.target.value
                          )
                        }
                        className="p-1 border border-gray-300 rounded-md resize-none overflow-hidden"
                        style={{
                          width: `${Math.max(
                            200,
                            (item.description || "").length * 8
                          )}px`,
                          height: "auto",
                          minHeight: "32px",
                        }}
                        placeholder="Enter description"
                        disabled={isLoading}
                        rows="1"
                        onInput={(e) => {
                          e.target.style.height = "auto";
                          e.target.style.height = e.target.scrollHeight + "px";
                        }}
                      />
                    </div>
                  </td>

                  <td className="px-4 py-2">
                    <select
                      value={item.gst}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "gst",
                          Number.parseInt(e.target.value)
                        )
                      }
                      className="w-20 p-1 border border-gray-300 rounded-md"
                      disabled={isLoading}
                    >
                      <option value="0">0%</option>
                      <option value="18">18%</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "qty",
                          Number.parseInt(e.target.value) || 0
                        )
                      }
                      className="w-16 p-1 border border-gray-300 rounded-md"
                      placeholder="0"
                      required
                      disabled={isLoading}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={item.units}
                      onChange={(e) =>
                        handleItemChange(item.id, "units", e.target.value)
                      }
                      className="w-20 p-1 border border-gray-300 rounded-md"
                      disabled={isLoading}
                    >
                      <option value="Nos">Nos</option>
                      <option value="Pcs">Pcs</option>
                      <option value="Kg">Kg</option>
                      <option value="Set">Set</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "rate",
                          Number.parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-24 p-1 border border-gray-300 rounded-md"
                      placeholder="0.00"
                      disabled={isLoading}
                      required
                    />
                  </td>
                  {!hideDisc && (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.discount}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "discount",
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        placeholder="0%"
                        min="0"
                        max="100"
                        disabled={isLoading}
                      />
                    </td>
                  )}
                  {!hideFlatDisc && (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.flatDiscount}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "flatDiscount",
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24 p-1 border border-gray-300 rounded-md"
                        placeholder="0.00"
                        min="0"
                        disabled={isLoading}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.amount}
                      className="w-24 p-1 border border-gray-300 rounded-md bg-gray-50"
                      readOnly
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      className="text-red-500 hover:text-red-700 p-1 rounded-md"
                      onClick={() => {
                        const newItems = quotationData.items.filter(
                          (i) => i.id !== item.id
                        );
                        if (newItems.length === 0) return;

                        const subtotal = newItems.reduce(
                          (sum, i) => sum + i.amount,
                          0
                        );
                        const subtotalAfterDiscount = Math.max(
                          0,
                          subtotal - quotationData.totalFlatDiscount
                        );

                        let cgstAmount = 0;
                        let sgstAmount = 0;
                        let igstAmount = 0;
                        let total = 0;

                        if (quotationData.isIGST) {
                          igstAmount = Number(
                            (
                              subtotalAfterDiscount *
                              (quotationData.igstRate / 100)
                            ).toFixed(2)
                          );
                          total = Number(
                            (
                              subtotalAfterDiscount +
                              igstAmount -
                              (Number(specialDiscount) || 0)
                            ).toFixed(2)
                          );
                        } else {
                          cgstAmount = Number(
                            (
                              subtotalAfterDiscount *
                              (quotationData.cgstRate / 100)
                            ).toFixed(2)
                          );
                          sgstAmount = Number(
                            (
                              subtotalAfterDiscount *
                              (quotationData.sgstRate / 100)
                            ).toFixed(2)
                          );
                          total = Number(
                            (
                              subtotalAfterDiscount +
                              cgstAmount +
                              sgstAmount -
                              (Number(specialDiscount) || 0)
                            ).toFixed(2)
                          );
                        }

                        setQuotationData({
                          ...quotationData,
                          items: newItems,
                          subtotal,
                          cgstAmount,
                          sgstAmount,
                          igstAmount,
                          total,
                        });
                      }}
                      disabled={quotationData.items.length <= 1 || isLoading}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={calculateColSpan()}
                  className="px-4 py-2 text-right font-medium"
                >
                  Subtotal:
                </td>
                <td className="border p-2">
                  ₹
                  {typeof quotationData.subtotal === "number"
                    ? quotationData.subtotal.toFixed(2)
                    : "0.00"}
                </td>
                <td></td>
              </tr>
              {!hideTotalFlatDisc && (
                <tr>
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right font-medium"
                  >
                    Total Flat Discount:
                  </td>
                  <td className="p-2">
                    ₹
                    {typeof quotationData.totalFlatDiscount === "number"
                      ? quotationData.totalFlatDiscount.toFixed(2)
                      : "0.00"}
                  </td>
                  <td></td>
                </tr>
              )}
              <tr className="border">
                <td
                  colSpan={calculateColSpan()}
                  className="px-4 py-2 text-right font-medium"
                >
                  Taxable Amount:
                </td>
                <td className="px-4 py-2">₹{taxableAmount.toFixed(2)}</td>
                <td></td>
              </tr>
              {quotationData.isIGST ? (
                <tr className="border">
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right font-medium"
                  >
                    IGST ({quotationData.igstRate}%):
                  </td>
                  <td className="px-4 py-2">
                    ₹{(quotationData.igstAmount || 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              ) : (
                <>
                  <tr className="border">
                    <td
                      colSpan={calculateColSpan()}
                      className="px-4 py-2 text-right font-medium"
                    >
                      CGST ({quotationData.cgstRate}%):
                    </td>
                    <td className="px-4 py-2">
                      ₹{quotationData.cgstAmount.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                  <tr className="border">
                    <td
                      colSpan={calculateColSpan()}
                      className="px-4 py-2 text-right font-medium"
                    >
                      SGST ({quotationData.sgstRate}%):
                    </td>
                    <td className="px-4 py-2">
                      ₹{quotationData.sgstAmount.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </>
              )}
              {!hideSpecialDiscount && (
                <tr>
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right font-medium"
                  >
                    Special Discount:
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={specialDiscount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSpecialDiscount(value);
                        handleSpecialDiscountChange(value);
                      }}
                      className="w-24 p-1 border border-gray-300 rounded-md"
                      min="0"
                      placeholder="0.00"
                      disabled={isLoading}
                    />
                  </td>
                  <td></td>
                </tr>
              )}
              <tr className="font-bold">
                <td
                  colSpan={calculateColSpan()}
                  className="px-4 py-2 text-right"
                >
                  Grand Total:
                </td>
                <td className="px-4 py-2">
                  ₹
                  {(() => {
                    const taxableAmt = Math.max(
                      0,
                      quotationData.subtotal - quotationData.totalFlatDiscount
                    );
                    let grandTotal = 0;

                    if (quotationData.isIGST) {
                      const igstAmt =
                        taxableAmt * (quotationData.igstRate / 100);
                      grandTotal =
                        taxableAmt + igstAmt - (Number(specialDiscount) || 0);
                    } else {
                      const cgstAmt =
                        taxableAmt * (quotationData.cgstRate / 100);
                      const sgstAmt =
                        taxableAmt * (quotationData.sgstRate / 100);
                      grandTotal =
                        taxableAmt +
                        cgstAmt +
                        sgstAmt -
                        (Number(specialDiscount) || 0);
                    }

                    return Math.max(0, grandTotal).toFixed(2);
                  })()}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table> */}

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  S No.
                </th>
                {!hideCode && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Code
                  </th>
                )}
                {!hideProductName && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Product Name
                  </th>
                )}
                {!hideDescription && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                )}
                {!hideGST && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    GST %
                  </th>
                )}
                {!hideQty && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Qty.
                  </th>
                )}
                {!hideUnits && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Units
                  </th>
                )}
                {!hideRate && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Rate
                  </th>
                )}
                {!hideDisc && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Disc %
                  </th>
                )}
                {!hideFlatDisc && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Flat Disc
                  </th>
                )}
                {!hideAmount && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                )}
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quotationData.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">{index + 1}</td>

                  {!hideCode && (
                    <td className="px-4 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={item.code}
                          onChange={(e) => {
                            handleItemChange(item.id, "code", e.target.value);
                            if (productData[e.target.value]) {
                              const productInfo = productData[e.target.value];
                              handleItemChange(
                                item.id,
                                "name",
                                productInfo.name
                              );
                              handleItemChange(
                                item.id,
                                "description",
                                productInfo.description
                              );
                              handleItemChange(
                                item.id,
                                "rate",
                                productInfo.rate
                              );
                            }
                          }}
                          list={`code-list-${item.id}`}
                          className="w-24 p-1 border border-gray-300 rounded-md"
                          disabled={isLoading}
                        />
                        <datalist id={`code-list-${item.id}`}>
                          {productCodes.map((code) => (
                            <option key={code} value={code} />
                          ))}
                        </datalist>
                      </div>
                    </td>
                  )}

                  {!hideProductName && (
                    <td className="px-4 py-2">
                      <div className="relative min-w-[200px]">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            handleItemChange(item.id, "name", e.target.value);
                            if (productData[e.target.value]) {
                              const productInfo = productData[e.target.value];
                              handleItemChange(
                                item.id,
                                "code",
                                productInfo.code
                              );
                              handleItemChange(
                                item.id,
                                "description",
                                productInfo.description
                              );
                              handleItemChange(
                                item.id,
                                "rate",
                                productInfo.rate
                              );
                            }
                          }}
                          list={`name-list-${item.id}`}
                          className="p-1 border border-gray-300 rounded-md"
                          style={{
                            width: `${Math.max(200, item.name.length * 8)}px`,
                          }}
                          placeholder="Enter item name"
                          disabled={isLoading}
                          required
                        />
                        <datalist id={`name-list-${item.id}`}>
                          {productNames.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      </div>
                    </td>
                  )}

                  {!hideDescription && (
                    <td className="px-4 py-2">
                      <div className="relative min-w-[200px]">
                        <textarea
                          value={item.description || ""}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              "description",
                              e.target.value
                            )
                          }
                          className="p-1 border border-gray-300 rounded-md resize-none overflow-hidden"
                          style={{
                            width: `${Math.max(
                              200,
                              (item.description || "").length * 8
                            )}px`,
                            height: "auto",
                            minHeight: "32px",
                          }}
                          placeholder="Enter description"
                          disabled={isLoading}
                          rows="1"
                          onInput={(e) => {
                            e.target.style.height = "auto";
                            e.target.style.height =
                              e.target.scrollHeight + "px";
                          }}
                        />
                      </div>
                    </td>
                  )}

                  {!hideGST && (
                    <td className="px-4 py-2">
                      <select
                        value={item.gst}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "gst",
                            Number.parseInt(e.target.value)
                          )
                        }
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        disabled={isLoading}
                      >
                        <option value="0">0%</option>
                        <option value="18">18%</option>
                      </select>
                    </td>
                  )}

                  {!hideQty && (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "qty",
                            Number.parseInt(e.target.value) || 0
                          )
                        }
                        className="w-16 p-1 border border-gray-300 rounded-md"
                        placeholder="0"
                        required
                        disabled={isLoading}
                      />
                    </td>
                  )}

                  {!hideUnits && (
                    <td className="px-4 py-2">
                      <select
                        value={item.units}
                        onChange={(e) =>
                          handleItemChange(item.id, "units", e.target.value)
                        }
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        disabled={isLoading}
                      >
                        <option value="Nos">Nos</option>
                        <option value="Pcs">Pcs</option>
                        <option value="Kg">Kg</option>
                        <option value="Set">Set</option>
                      </select>
                    </td>
                  )}

                  {!hideRate && (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "rate",
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24 p-1 border border-gray-300 rounded-md"
                        placeholder="0.00"
                        disabled={isLoading}
                        required
                      />
                    </td>
                  )}

                  {!hideDisc && (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.discount}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "discount",
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-20 p-1 border border-gray-300 rounded-md"
                        placeholder="0%"
                        min="0"
                        max="100"
                        disabled={isLoading}
                      />
                    </td>
                  )}

                  {!hideFlatDisc && (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.flatDiscount}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "flatDiscount",
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-24 p-1 border border-gray-300 rounded-md"
                        placeholder="0.00"
                        min="0"
                        disabled={isLoading}
                      />
                    </td>
                  )}

                  {!hideAmount && (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.amount}
                        className="w-24 p-1 border border-gray-300 rounded-md bg-gray-50"
                        readOnly
                      />
                    </td>
                  )}

                  <td className="px-4 py-2">
                    <button
                      className="text-red-500 hover:text-red-700 p-1 rounded-md"
                      onClick={() => {
                        const newItems = quotationData.items.filter(
                          (i) => i.id !== item.id
                        );
                        if (newItems.length === 0) return;

                        const subtotal = newItems.reduce(
                          (sum, i) => sum + i.amount,
                          0
                        );
                        const subtotalAfterDiscount = Math.max(
                          0,
                          subtotal - quotationData.totalFlatDiscount
                        );

                        let cgstAmount = 0;
                        let sgstAmount = 0;
                        let igstAmount = 0;
                        let total = 0;

                        if (quotationData.isIGST) {
                          igstAmount = Number(
                            (
                              subtotalAfterDiscount *
                              (quotationData.igstRate / 100)
                            ).toFixed(2)
                          );
                          total = Number(
                            (
                              subtotalAfterDiscount +
                              igstAmount -
                              (Number(specialDiscount) || 0)
                            ).toFixed(2)
                          );
                        } else {
                          cgstAmount = Number(
                            (
                              subtotalAfterDiscount *
                              (quotationData.cgstRate / 100)
                            ).toFixed(2)
                          );
                          sgstAmount = Number(
                            (
                              subtotalAfterDiscount *
                              (quotationData.sgstRate / 100)
                            ).toFixed(2)
                          );
                          total = Number(
                            (
                              subtotalAfterDiscount +
                              cgstAmount +
                              sgstAmount -
                              (Number(specialDiscount) || 0)
                            ).toFixed(2)
                          );
                        }

                        setQuotationData({
                          ...quotationData,
                          items: newItems,
                          subtotal,
                          cgstAmount,
                          sgstAmount,
                          igstAmount,
                          total,
                        });
                      }}
                      disabled={quotationData.items.length <= 1 || isLoading}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {!hiddenColumns?.hideSubtotal && (
                <tr>
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right font-medium"
                  >
                    Subtotal:
                  </td>
                  <td className="border p-2">
                    ₹
                    {typeof quotationData.subtotal === "number"
                      ? quotationData.subtotal.toFixed(2)
                      : "0.00"}
                  </td>
                  <td></td>
                </tr>
              )}

              {!hiddenColumns?.hideTotalQty && (
                <tr>
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right font-medium"
                  >
                    Total Qty:
                  </td>
                  <td className="px-4 py-2">
                    {quotationData.items.reduce(
                      (sum, item) => sum + (Number(item.qty) || 0),
                      0
                    )}
                  </td>
                  <td></td>
                </tr>
              )}

              {!hideTotalFlatDisc && (
                <tr>
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right font-medium"
                  >
                    Total Flat Discount:
                  </td>
                  <td className="p-2">
                    ₹
                    {typeof quotationData.totalFlatDiscount === "number"
                      ? quotationData.totalFlatDiscount.toFixed(2)
                      : "0.00"}
                  </td>
                  <td></td>
                </tr>
              )}

              {!hiddenColumns?.hideTaxableAmount && (
                <tr className="border">
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right font-medium"
                  >
                    Taxable Amount:
                  </td>
                  <td className="px-4 py-2">₹{taxableAmount.toFixed(2)}</td>
                  <td></td>
                </tr>
              )}

              {!hiddenColumns?.hideIGST && quotationData.isIGST ? (
                <tr className="border">
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right font-medium"
                  >
                    IGST ({quotationData.igstRate}%):
                  </td>
                  <td className="px-4 py-2">
                    ₹{(quotationData.igstAmount || 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              ) : (
                <>
                  {!hiddenColumns?.hideCGST && (
                    <tr className="border">
                      <td
                        colSpan={calculateColSpan()}
                        className="px-4 py-2 text-right font-medium"
                      >
                        CGST ({quotationData.cgstRate}%):
                      </td>
                      <td className="px-4 py-2">
                        ₹{quotationData.cgstAmount.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  )}
                  {!hiddenColumns?.hideSGST && (
                    <tr className="border">
                      <td
                        colSpan={calculateColSpan()}
                        className="px-4 py-2 text-right font-medium"
                      >
                        SGST ({quotationData.sgstRate}%):
                      </td>
                      <td className="px-4 py-2">
                        ₹{quotationData.sgstAmount.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  )}
                </>
              )}

              {!hideSpecialDiscount && (
                <tr>
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right font-medium"
                  >
                    Special Discount:
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={specialDiscount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSpecialDiscount(value);
                        handleSpecialDiscountChange(value);
                      }}
                      className="w-24 p-1 border border-gray-300 rounded-md"
                      min="0"
                      placeholder="0.00"
                      disabled={isLoading}
                    />
                  </td>
                  <td></td>
                </tr>
              )}

              {!hiddenColumns?.hideTotalDiscount && (
                <tr>
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right font-medium"
                  >
                    Total Discount:
                  </td>
                  <td className="px-4 py-2">
                    ₹
                    {(() => {
                      const discountFromPercentage = quotationData.items.reduce(
                        (sum, item) => {
                          const itemTotal = item.qty * item.rate;
                          return sum + itemTotal * (item.discount / 100);
                        },
                        0
                      );
                      const totalDiscount =
                        discountFromPercentage +
                        quotationData.totalFlatDiscount +
                        (Number(specialDiscount) || 0);
                      return totalDiscount.toFixed(2);
                    })()}
                  </td>
                  <td></td>
                </tr>
              )}

              {!hiddenColumns?.hideGrandTotal && (
                <tr className="font-bold">
                  <td
                    colSpan={calculateColSpan()}
                    className="px-4 py-2 text-right"
                  >
                    Grand Total:
                  </td>
                  <td className="px-4 py-2">
                    ₹
                    {(() => {
                      const taxableAmt = Math.max(
                        0,
                        quotationData.subtotal - quotationData.totalFlatDiscount
                      );
                      let grandTotal = 0;

                      if (quotationData.isIGST) {
                        const igstAmt =
                          taxableAmt * (quotationData.igstRate / 100);
                        grandTotal =
                          taxableAmt + igstAmt - (Number(specialDiscount) || 0);
                      } else {
                        const cgstAmt =
                          taxableAmt * (quotationData.cgstRate / 100);
                        const sgstAmt =
                          taxableAmt * (quotationData.sgstRate / 100);
                        grandTotal =
                          taxableAmt +
                          cgstAmt +
                          sgstAmt -
                          (Number(specialDiscount) || 0);
                      }

                      return Math.max(0, grandTotal).toFixed(2);
                    })()}
                  </td>
                  <td></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ItemsTable;
