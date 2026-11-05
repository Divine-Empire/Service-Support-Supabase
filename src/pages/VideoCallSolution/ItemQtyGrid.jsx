import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Plus, Trash2 } from "lucide-react";

// "Item & Quantity Details" grid (up to 15 rows) shown when the video call did not solve the issue.
export default function ItemQtyGrid({ handleAddItemRow, itemRows, handleItemRowChange, masterData, handleDeleteItemRow }) {
  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold text-foreground">Item & Quantity Details *</h4>
        <Button
          type="button"
          onClick={handleAddItemRow}
          disabled={itemRows.length >= 15}
          className="flex items-center space-x-1 px-3 py-1 rounded-md text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Row ({itemRows.length}/15)</span>
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden border-border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Item Name *</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground w-24">Qty *</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground w-16">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-border">
            {itemRows.map((row, index) => (
              <tr key={index}>
                <td className="px-4 py-2">
                  <Input
                    aria-label={`Item name, row ${index + 1}`}
                    placeholder="Enter item name..."
                    value={row.item}
                    onChange={(e) => handleItemRowChange(index, "item", e.target.value)}
                    className="w-full border-border rounded text-sm h-8"
                    required={index === 0}
                    list={`item-options-${index}`}
                  />
                  <datalist id={`item-options-${index}`}>
                    {masterData[0]?.["Item-Name"]?.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min="1"
                    aria-label={`Quantity, row ${index + 1}`}
                    placeholder="Qty"
                    value={row.qty}
                    onChange={(e) => handleItemRowChange(index, "qty", e.target.value)}
                    className="w-full border-border rounded text-sm h-8"
                    required={index === 0}
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleDeleteItemRow(index)}
                    aria-label={`Delete row ${index + 1}`}
                    disabled={itemRows.length <= 1}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 h-auto rounded-md disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
