import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Field, TextInput, TextArea, Select } from "../ui/Field.jsx";
import { TagInput } from "../ui/TagInput.jsx";
import { StringListManager } from "../ui/StringListManager.jsx";
import { ReorderList } from "../ui/ReorderList.jsx";
import { TabShell } from "./TabShell.jsx";
import { uid } from "../../utils/uid.js";

const CATEGORIES = ["Web App", "Mobile", "Data Science", "Open Source", "Design", "Other"];

export function TabProjects() {
  const items = usePortfolioStore((s) => s.data.projects);
  const addItem = usePortfolioStore((s) => s.addItem);
  const removeItem = usePortfolioStore((s) => s.removeItem);
  const updateItem = usePortfolioStore((s) => s.updateItem);
  const reorderItems = usePortfolioStore((s) => s.reorderItems);

  const blank = () => ({
    id: uid(),
    name: "New Project",
    category: "Web App",
    shortDesc: "",
    fullDesc: "",
    tech: [],
    images: ["https://placehold.co/900x650/12141f/00c9ff?text=Project"],
    demoUrl: "",
    repoUrl: "",
    features: [],
    metrics: "",
  });

  return (
    <TabShell title="Projects" description="Drag ⠿ to reorder. Categories auto-generate the filter tabs on your portfolio.">
      <ReorderList
        items={items}
        onReorder={(from, to) => reorderItems("projects", from, to)}
        onRemove={(id) => removeItem("projects", id)}
        onAdd={() => addItem("projects", blank())}
        addLabel="Add Project"
        renderItem={(item) => (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Project Name">
                <TextInput value={item.name} onChange={(e) => updateItem("projects", item.id, { name: e.target.value })} />
              </Field>
              <Field label="Category">
                <Select value={item.category} onChange={(e) => updateItem("projects", item.id, { category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Short Description" hint="Shown on the project card.">
              <TextInput value={item.shortDesc} onChange={(e) => updateItem("projects", item.id, { shortDesc: e.target.value })} />
            </Field>
            <Field label="Detailed Description" hint="Shown in the expanded case-study view.">
              <TextArea rows={3} value={item.fullDesc} onChange={(e) => updateItem("projects", item.id, { fullDesc: e.target.value })} />
            </Field>
            <Field label="Tech Stack">
              <TagInput tags={item.tech} onChange={(v) => updateItem("projects", item.id, { tech: v })} />
            </Field>
            <Field label="Screenshots (URLs)">
              <StringListManager
                items={item.images}
                onChange={(v) => updateItem("projects", item.id, { images: v })}
                placeholder="https://…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Live Demo URL">
                <TextInput value={item.demoUrl} onChange={(e) => updateItem("projects", item.id, { demoUrl: e.target.value })} />
              </Field>
              <Field label="GitHub / Source URL">
                <TextInput value={item.repoUrl} onChange={(e) => updateItem("projects", item.id, { repoUrl: e.target.value })} />
              </Field>
            </div>
            <Field label="Key Features">
              <StringListManager
                items={item.features}
                onChange={(v) => updateItem("projects", item.id, { features: v })}
                placeholder="e.g. Real-time sync"
              />
            </Field>
            <Field label="Results / Metrics (optional)">
              <TextInput value={item.metrics} onChange={(e) => updateItem("projects", item.id, { metrics: e.target.value })} />
            </Field>
          </div>
        )}
      />
    </TabShell>
  );
}
