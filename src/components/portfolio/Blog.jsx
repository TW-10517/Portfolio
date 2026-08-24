import { useState } from "react";
import { usePortfolioTheme } from "./ThemeContext.jsx";
import { Reveal } from "./Reveal.jsx";
import { SectionTag } from "./SectionTag.jsx";
import { sanitizeUrl } from "../../utils/sanitizeUrl.js";

export function Blog() {
  const { data, palette, primary, animationLevel } = usePortfolioTheme();
  const { enabled, posts } = data.blog;
  const categories = ["All", ...Array.from(new Set(posts.map((p) => p.category).filter(Boolean)))];
  const [filter, setFilter] = useState("All");

  if (!enabled || posts.length === 0) return null;
  const filtered = filter === "All" ? posts : posts.filter((p) => p.category === filter);

  return (
    <section id="blog" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <Reveal animationLevel={animationLevel}>
          <SectionTag>Writing</SectionTag>
          <h2 className="font-head font-bold text-3xl md:text-4xl mb-6" style={{ color: palette.text }}>
            Blog &amp; <span style={{ color: primary }}>Insights</span>
          </h2>
        </Reveal>

        {categories.length > 2 && (
          <Reveal animationLevel={animationLevel} className="flex flex-wrap gap-2 mb-8">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className="px-4 py-1.5 rounded-full text-xs font-medium border"
                style={filter === c ? { background: primary, color: "#06070d", borderColor: "transparent" } : { borderColor: palette.border, color: palette.textDim }}
              >
                {c}
              </button>
            ))}
          </Reveal>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((post, i) => (
            <Reveal key={post.id} animationLevel={animationLevel} delay={(i % 6) * 0.06}>
              <a
                href={sanitizeUrl(post.url) || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl overflow-hidden border"
                style={{ borderColor: palette.border, background: palette.surface }}
              >
                {post.thumbnail && <img src={post.thumbnail} alt={post.title} className="w-full aspect-video object-cover" />}
                <div className="p-5">
                  <div className="flex gap-2 text-xs mb-2" style={{ color: palette.textFaint }}>
                    {post.date && <span>{post.date}</span>}
                    {post.category && <span>· {post.category}</span>}
                  </div>
                  <h3 className="font-head font-semibold mb-2" style={{ color: palette.text }}>{post.title}</h3>
                  <p className="text-sm" style={{ color: palette.textDim }}>{post.excerpt}</p>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
