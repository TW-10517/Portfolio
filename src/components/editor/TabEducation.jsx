import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Field, TextInput, TextArea } from "../ui/Field.jsx";
import { ImageUpload } from "../ui/ImageUpload.jsx";
import { ReorderList } from "../ui/ReorderList.jsx";
import { TabShell, SubHeading } from "./TabShell.jsx";
import { uid } from "../../utils/uid.js";

export function TabEducation() {
  const degrees = usePortfolioStore((s) => s.data.education.degrees);
  const certifications = usePortfolioStore((s) => s.data.education.certifications);
  const awards = usePortfolioStore((s) => s.data.education.awards);
  const update = usePortfolioStore((s) => s.update);

  const setDegrees = (v) => update(["education", "degrees"], v);
  const setCerts = (v) => update(["education", "certifications"], v);
  const setAwards = (v) => update(["education", "awards"], v);

  const patchList = (list, setList, id, patch) => setList(list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeFrom = (list, setList, id) => setList(list.filter((i) => i.id !== id));
  const reorder = (list, setList, from, to) => {
    const next = [...list];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setList(next);
  };

  return (
    <TabShell title="Education & Certifications">
      <SubHeading>Education</SubHeading>
      <ReorderList
        items={degrees}
        onReorder={(f, t) => reorder(degrees, setDegrees, f, t)}
        onRemove={(id) => removeFrom(degrees, setDegrees, id)}
        onAdd={() => setDegrees([...degrees, { id: uid(), degree: "Degree Name", institution: "Institution", year: "", achievements: "" }])}
        addLabel="Add Degree"
        renderItem={(item) => (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Degree / Program">
                <TextInput value={item.degree} onChange={(e) => patchList(degrees, setDegrees, item.id, { degree: e.target.value })} />
              </Field>
              <Field label="University / Institution">
                <TextInput value={item.institution} onChange={(e) => patchList(degrees, setDegrees, item.id, { institution: e.target.value })} />
              </Field>
            </div>
            <Field label="Year / Duration">
              <TextInput value={item.year} onChange={(e) => patchList(degrees, setDegrees, item.id, { year: e.target.value })} />
            </Field>
            <Field label="Notable Achievements">
              <TextArea rows={2} value={item.achievements} onChange={(e) => patchList(degrees, setDegrees, item.id, { achievements: e.target.value })} />
            </Field>
          </div>
        )}
      />

      <SubHeading>Certifications</SubHeading>
      <ReorderList
        items={certifications}
        onReorder={(f, t) => reorder(certifications, setCerts, f, t)}
        onRemove={(id) => removeFrom(certifications, setCerts, id)}
        onAdd={() => setCerts([...certifications, { id: uid(), name: "Certification Name", issuer: "", year: "", url: "", badge: "" }])}
        addLabel="Add Certification"
        renderItem={(item) => (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Certification Name">
                <TextInput value={item.name} onChange={(e) => patchList(certifications, setCerts, item.id, { name: e.target.value })} />
              </Field>
              <Field label="Issuing Organization">
                <TextInput value={item.issuer} onChange={(e) => patchList(certifications, setCerts, item.id, { issuer: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Year">
                <TextInput value={item.year} onChange={(e) => patchList(certifications, setCerts, item.id, { year: e.target.value })} />
              </Field>
              <Field label="Credential URL (optional)">
                <TextInput value={item.url} onChange={(e) => patchList(certifications, setCerts, item.id, { url: e.target.value })} />
              </Field>
            </div>
            <Field label="Badge Image (optional)">
              <ImageUpload value={item.badge} onChange={(v) => patchList(certifications, setCerts, item.id, { badge: v })} />
            </Field>
          </div>
        )}
      />

      <SubHeading>Awards / Honors</SubHeading>
      <ReorderList
        items={awards}
        onReorder={(f, t) => reorder(awards, setAwards, f, t)}
        onRemove={(id) => removeFrom(awards, setAwards, id)}
        onAdd={() => setAwards([...awards, { id: uid(), name: "Award Name", issuer: "", year: "" }])}
        addLabel="Add Award"
        renderItem={(item) => (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Name">
              <TextInput value={item.name} onChange={(e) => patchList(awards, setAwards, item.id, { name: e.target.value })} />
            </Field>
            <Field label="Issuer">
              <TextInput value={item.issuer} onChange={(e) => patchList(awards, setAwards, item.id, { issuer: e.target.value })} />
            </Field>
            <Field label="Year">
              <TextInput value={item.year} onChange={(e) => patchList(awards, setAwards, item.id, { year: e.target.value })} />
            </Field>
          </div>
        )}
      />
    </TabShell>
  );
}
