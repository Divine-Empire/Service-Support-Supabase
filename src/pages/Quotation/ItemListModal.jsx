import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";

// Item Name / Qty list of a ticket's enquiry. Render it only while open.
export default function ItemListModal({ items, onClose }) {
  return (
      <Modal isOpen onClose={onClose} title="Item List" size="lg">
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm font-medium">No items found for this ticket.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold w-10">#</th>
                  <th className="px-4 py-2 text-left font-semibold">Item Name</th>
                  <th className="px-4 py-2 text-center font-semibold w-20">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2.5 text-muted-foreground font-medium">{idx + 1}</td>
                    <td className="px-4 py-2.5 text-foreground">{row.item || "—"}</td>
                    <td className="px-4 py-2.5 text-center text-foreground font-semibold">{row.qty || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="pt-4 flex justify-end">
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
  );
}
