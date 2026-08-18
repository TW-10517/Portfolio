import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Field, TextInput, TextArea } from "../ui/Field.jsx";
import { ImageUpload } from "../ui/ImageUpload.jsx";
import { ReorderList } from "../ui/ReorderList.jsx";
import { Toggle } from "../ui/Toggle.jsx";
import { TabShell } from "./TabShell.jsx";
import { uid } from "../../utils/uid.js";

export function TabBlog() {
  const enabled = usePortfolioStore((s) => s.data.blog.enabled);
  const posts = usePortfolioStore((s) => s.data.blog.posts);
  const update = usePortfolioStore((s) => s.update);
  const addItem = usePortfolioStore((s) => s.addItem);
  const removeItem = usePortfolioStore((s) => s.removeItem);
  const updateItem = usePortfolioStore((s) => s.updateItem);
  const reorderItems = usePortfolioStore((s) => s.reorderItems);

  const blank = () => ({ id: uid(), title: "New Post", excerpt: "", date: "", category: "", url: "", thumbnail: "" });

  return (
    <TabShell title="Blog / Insights" description="Optional section linking out to your writing.">
      <Toggle checked={enabled} onChange={(v) => update(["blog", "enabled"], v)} label="Show Blog section on portfolio" />

      {enabled && (
        <div className="pt-2">
          <ReorderList
            items={posts}
            onReorder={(from, to) => reorderItems("blog.posts", from, to)}
            onRemove={(id) => removeItem("blog.posts", id)}
            onAdd={() => addItem("blog.posts", blank())}
            addLabel="Add Post"
            renderItem={(item) => (
              <div className="space-y-3">
                <Field label="Title">
                  <TextInput value={item.title} onChange={(e) => updateItem("blog.posts", item.id, { title: e.target.value })} />
                </Field>
                <Field label="Excerpt">
                  <TextArea rows={2} value={item.excerpt} onChange={(e) => updateItem("blog.posts", item.id, { excerpt: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date">
                    <TextInput type="date" value={item.date} onChange={(e) => updateItem("blog.posts", item.id, { date: e.target.value })} />
                  </Field>
                  <Field label="Category Tag">
                    <TextInput value={item.category} onChange={(e) => updateItem("blog.posts", item.id, { category: e.target.value })} />
                  </Field>
                </div>
                <Field label="External URL">
                  <TextInput value={item.url} onChange={(e) => updateItem("blog.posts", item.id, { url: e.target.value })} />
                </Field>
                <Field label="Thumbnail">
                  <ImageUpload value={item.thumbnail} onChange={(v) => updateItem("blog.posts", item.id, { thumbnail: v })} />
                </Field>
              </div>
            )}
          />
        </div>
      )}
    </TabShell>
  );
}
