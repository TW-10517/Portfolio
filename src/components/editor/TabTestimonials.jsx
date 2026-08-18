import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Field, TextInput, TextArea } from "../ui/Field.jsx";
import { ImageUpload } from "../ui/ImageUpload.jsx";
import { ReorderList } from "../ui/ReorderList.jsx";
import { TabShell } from "./TabShell.jsx";
import { uid } from "../../utils/uid.js";

export function TabTestimonials() {
  const items = usePortfolioStore((s) => s.data.testimonials);
  const addItem = usePortfolioStore((s) => s.addItem);
  const removeItem = usePortfolioStore((s) => s.removeItem);
  const updateItem = usePortfolioStore((s) => s.updateItem);
  const reorderItems = usePortfolioStore((s) => s.reorderItems);

  const blank = () => ({ id: uid(), quote: "", name: "Person Name", role: "", company: "", photo: "", rating: 5 });

  return (
    <TabShell title="Testimonials" description="Kind words from people you've worked with.">
      <ReorderList
        items={items}
        onReorder={(from, to) => reorderItems("testimonials", from, to)}
        onRemove={(id) => removeItem("testimonials", id)}
        onAdd={() => addItem("testimonials", blank())}
        addLabel="Add Testimonial"
        renderItem={(item) => (
          <div className="space-y-3">
            <Field label="Quote">
              <TextArea rows={3} value={item.quote} onChange={(e) => updateItem("testimonials", item.id, { quote: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <TextInput value={item.name} onChange={(e) => updateItem("testimonials", item.id, { name: e.target.value })} />
              </Field>
              <Field label="Role / Title">
                <TextInput value={item.role} onChange={(e) => updateItem("testimonials", item.id, { role: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company">
                <TextInput value={item.company} onChange={(e) => updateItem("testimonials", item.id, { company: e.target.value })} />
              </Field>
              <Field label="Rating (1–5, optional)">
                <TextInput
                  type="number"
                  min={0}
                  max={5}
                  value={item.rating}
                  onChange={(e) => updateItem("testimonials", item.id, { rating: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Photo (optional)">
              <ImageUpload value={item.photo} onChange={(v) => updateItem("testimonials", item.id, { photo: v })} round />
            </Field>
          </div>
        )}
      />
    </TabShell>
  );
}
