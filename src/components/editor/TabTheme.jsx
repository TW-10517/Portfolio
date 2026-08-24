import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Field, Select, TextArea } from "../ui/Field.jsx";
import { ColorPicker } from "../ui/ColorPicker.jsx";
import { TabShell, SubHeading } from "./TabShell.jsx";
import { FONT_OPTIONS, PALETTES } from "../../data/defaults.js";

export function TabTheme() {
  const theme = usePortfolioStore((s) => s.data.theme);
  const update = usePortfolioStore((s) => s.update);
  const set = (key, value) => update(["theme", key], value);

  return (
    <TabShell title="Theme & Design" description="Fine-tune how your published portfolio looks and feels.">
      <SubHeading>Color Scheme</SubHeading>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {PALETTES.map((p) => (
          <button
            key={p.name}
            type="button"
            title={p.name}
            onClick={() => {
              set("primary", p.primary);
              set("secondary", p.secondary);
            }}
            className={`h-10 rounded-lg border-2 transition ${theme.primary === p.primary && theme.secondary === p.secondary ? "border-white" : "border-transparent"}`}
            style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }}
          />
        ))}
      </div>
      <div className="space-y-3">
        <ColorPicker value={theme.primary} onChange={(v) => set("primary", v)} label="Primary" />
        <ColorPicker value={theme.secondary} onChange={(v) => set("secondary", v)} label="Secondary" />
      </div>

      <SubHeading>Mode</SubHeading>
      <Field label="Color mode">
        <Select value={theme.mode} onChange={(e) => set("mode", e.target.value)}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="auto">Auto (system preference)</option>
        </Select>
      </Field>

      <SubHeading>Typography</SubHeading>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Heading Font">
          <Select value={theme.headingFont} onChange={(e) => set("headingFont", e.target.value)}>
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </Select>
        </Field>
        <Field label="Body Font">
          <Select value={theme.bodyFont} onChange={(e) => set("bodyFont", e.target.value)}>
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-slate-400 -mt-2" style={{ fontFamily: theme.headingFont }}>
        Preview: The quick brown fox jumps.
      </p>

      <SubHeading>Layout Style</SubHeading>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Hero style">
          <Select value={theme.heroStyle} onChange={(e) => set("heroStyle", e.target.value)}>
            <option value="centered">Centered</option>
            <option value="split">Split (photo left, text right)</option>
            <option value="minimal">Minimal</option>
          </Select>
        </Field>
        <Field label="Project layout">
          <Select value={theme.projectLayout} onChange={(e) => set("projectLayout", e.target.value)}>
            <option value="grid">Grid</option>
            <option value="masonry">Masonry</option>
            <option value="list">List</option>
          </Select>
        </Field>
        <Field label="Experience layout">
          <Select value={theme.experienceLayout} onChange={(e) => set("experienceLayout", e.target.value)}>
            <option value="timeline">Timeline</option>
            <option value="cards">Cards</option>
            <option value="list">List</option>
          </Select>
        </Field>
      </div>

      <SubHeading>Animation Level</SubHeading>
      <Field label="Motion intensity" hint="'None' also respects prefers-reduced-motion automatically.">
        <Select value={theme.animationLevel} onChange={(e) => set("animationLevel", e.target.value)}>
          <option value="full">Full</option>
          <option value="subtle">Subtle</option>
          <option value="none">None</option>
        </Select>
      </Field>

      <SubHeading>Custom CSS (advanced)</SubHeading>
      <p className="text-[11px] text-slate-400 -mt-2 mb-2">
        Applies to your published page. For visitors' safety, <code>url()</code>, <code>@import</code>, and fixed-position overlays are stripped.
      </p>
      <TextArea
        rows={5}
        value={theme.customCss}
        onChange={(e) => set("customCss", e.target.value)}
        placeholder=".hero h1 { letter-spacing: -0.02em; }"
        className="font-mono text-xs"
      />
    </TabShell>
  );
}
