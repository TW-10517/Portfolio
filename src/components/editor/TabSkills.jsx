import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { TextInput } from "../ui/Field.jsx";
import { Button } from "../ui/Button.jsx";
import { StringListManager } from "../ui/StringListManager.jsx";
import { TabShell, SubHeading } from "./TabShell.jsx";
import { uid } from "../../utils/uid.js";

export function TabSkills() {
  const categories = usePortfolioStore((s) => s.data.skills.categories);
  const learning = usePortfolioStore((s) => s.data.skills.learning);
  const update = usePortfolioStore((s) => s.update);

  const setCategories = (next) => update(["skills", "categories"], next);
  const setLearning = (next) => update(["skills", "learning"], next);

  const addCategory = () =>
    setCategories([...categories, { id: uid(), name: "New Category", skills: [] }]);

  const removeCategory = (id) => setCategories(categories.filter((c) => c.id !== id));

  const renameCategory = (id, name) =>
    setCategories(categories.map((c) => (c.id === id ? { ...c, name } : c)));

  const addSkill = (catId) =>
    setCategories(
      categories.map((c) => (c.id === catId ? { ...c, skills: [...c.skills, { id: uid(), name: "New Skill", level: 50 }] } : c))
    );

  const updateSkill = (catId, skillId, patch) =>
    setCategories(
      categories.map((c) =>
        c.id === catId ? { ...c, skills: c.skills.map((s) => (s.id === skillId ? { ...s, ...patch } : s)) } : c
      )
    );

  const removeSkill = (catId, skillId) =>
    setCategories(categories.map((c) => (c.id === catId ? { ...c, skills: c.skills.filter((s) => s.id !== skillId) } : c)));

  return (
    <TabShell title="Skills" description="Group your skills into categories with proficiency levels.">
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-xl bg-slate-900/60 border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TextInput value={cat.name} onChange={(e) => renameCategory(cat.id, e.target.value)} className="font-medium" />
              <button
                type="button"
                onClick={() => removeCategory(cat.id)}
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                aria-label="Remove category"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3">
              {cat.skills.map((skill) => (
                <div key={skill.id} className="flex items-center gap-2">
                  <input
                    value={skill.name}
                    onChange={(e) => updateSkill(cat.id, skill.id, { name: e.target.value })}
                    className="w-32 shrink-0 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={skill.level}
                    onChange={(e) => updateSkill(cat.id, skill.id, { level: Number(e.target.value) })}
                    className="flex-1 accent-cyan-400"
                  />
                  <span className="w-9 text-xs text-slate-400 text-right">{skill.level}%</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(cat.id, skill.id)}
                    className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400"
                    aria-label="Remove skill"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addSkill(cat.id)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                + Add skill
              </button>
            </div>
          </div>
        ))}
        <Button variant="subtle" size="sm" onClick={addCategory}>
          + Add Category
        </Button>
      </div>

      <SubHeading>Currently Learning</SubHeading>
      <StringListManager items={learning} onChange={setLearning} placeholder="e.g. Rust" />
    </TabShell>
  );
}
