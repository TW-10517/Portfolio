import { useMemo, useState } from "react";
import { usePortfolioTheme } from "./ThemeContext.jsx";
import { Reveal } from "./Reveal.jsx";
import { SectionTag } from "./SectionTag.jsx";
import { Modal } from "../ui/Modal.jsx";
import { sanitizeUrl } from "../../utils/sanitizeUrl.js";
import { resolveImageUrl } from "../../utils/imageUrl.js";

function ProjectCard({ project, palette, primary, onOpen }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  return (
    <div
      className="rounded-2xl overflow-hidden border cursor-pointer transition-shadow"
      style={{ borderColor: palette.border, background: palette.surface, transform: `perspective(800px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)` }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        setTilt({ x: x * 8, y: -y * 8 });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      onClick={() => onOpen(project)}
    >
      <div className="aspect-[4/3] overflow-hidden">
        <img src={resolveImageUrl(project.images?.[0])} alt={project.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-5">
        <h3 className="font-head font-semibold mb-1.5" style={{ color: palette.text }}>{project.name}</h3>
        <p className="text-sm mb-3" style={{ color: palette.textDim }}>{project.shortDesc}</p>
        <div className="flex flex-wrap gap-1.5">
          {project.tech?.slice(0, 3).map((t) => (
            <span key={t} className="text-xs px-2.5 py-0.5 rounded-full border" style={{ borderColor: palette.border, color: palette.textDim }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Projects() {
  const { data, palette, primary, secondary, animationLevel } = usePortfolioTheme();
  const items = data.projects;
  const layout = data.theme?.projectLayout || "grid";
  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((p) => p.category)))], [items]);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const filtered = filter === "All" ? items : items.filter((p) => p.category === filter);

  const gridClass = layout === "list" ? "grid grid-cols-1 gap-4" : "grid sm:grid-cols-2 lg:grid-cols-3 gap-6";

  return (
    <section id="projects" className="py-24 px-6" style={{ background: palette.surface + "40" }}>
      <div className="max-w-6xl mx-auto">
        <Reveal animationLevel={animationLevel}>
          <SectionTag>Selected work</SectionTag>
          <h2 className="font-head font-bold text-3xl md:text-4xl mb-6" style={{ color: palette.text }}>
            My <span style={{ color: primary }}>Projects</span>
          </h2>
        </Reveal>

        <Reveal animationLevel={animationLevel} className="flex flex-wrap gap-2 mb-10">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className="px-4 py-2 rounded-full text-xs font-medium border transition"
              style={
                filter === c
                  ? { background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: "#06070d", borderColor: "transparent" }
                  : { borderColor: palette.border, color: palette.textDim }
              }
            >
              {c}
            </button>
          ))}
        </Reveal>

        <div className={gridClass}>
          {filtered.map((p, i) => (
            <Reveal key={p.id} animationLevel={animationLevel} delay={(i % 6) * 0.06}>
              <ProjectCard project={p} palette={palette} primary={primary} onOpen={setSelected} />
            </Reveal>
          ))}
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} wide label={selected ? `Project: ${selected.name}` : "Project details"}>
        {selected && (
          <div>
            {selected.images?.[0] && <img src={resolveImageUrl(selected.images[0])} alt={selected.name} className="w-full rounded-xl mb-5 max-h-72 object-cover" />}
            <h2 className="text-2xl font-head font-bold mb-2 text-white">{selected.name}</h2>
            <p className="text-slate-400 mb-4">{selected.fullDesc || selected.shortDesc}</p>
            {selected.tech?.length > 0 && (
              <>
                <h4 className="text-xs uppercase tracking-wide text-cyan-400 mb-2 mt-4">Tech Stack</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selected.tech.map((t) => (
                    <span key={t} className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">{t}</span>
                  ))}
                </div>
              </>
            )}
            {selected.features?.length > 0 && (
              <>
                <h4 className="text-xs uppercase tracking-wide text-cyan-400 mb-2 mt-4">Key Features</h4>
                <ul className="list-disc pl-5 text-sm text-slate-400 space-y-1">
                  {selected.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </>
            )}
            {selected.metrics && (
              <>
                <h4 className="text-xs uppercase tracking-wide text-cyan-400 mb-2 mt-4">Results</h4>
                <p className="text-sm text-slate-400">{selected.metrics}</p>
              </>
            )}
            <div className="flex gap-3 mt-6">
              {selected.demoUrl && (
                <a href={sanitizeUrl(selected.demoUrl)} target="_blank" rel="noopener noreferrer" className="px-5 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950">
                  Live Demo
                </a>
              )}
              {selected.repoUrl && (
                <a href={sanitizeUrl(selected.repoUrl)} target="_blank" rel="noopener noreferrer" className="px-5 py-2 rounded-full text-sm font-semibold border border-slate-600 text-slate-200">
                  Source
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
