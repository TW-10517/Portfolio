/* =========================================================
   Alex Rivera — Portfolio shared interactions
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {

  /* ---------- Loader ---------- */
  const loader = document.getElementById("loader");
  if (loader) {
    window.addEventListener("load", () => {
      setTimeout(() => loader.classList.add("hidden"), 400);
    });
    // fallback in case 'load' already fired
    setTimeout(() => loader.classList.add("hidden"), 2200);
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Theme toggle (persisted) ---------- */
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  document.querySelectorAll(".theme-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme") === "light" ? "light" : "dark";
      const next = current === "light" ? "dark" : "light";
      if (next === "dark") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", "light");
      localStorage.setItem("theme", next);
    });
  });

  /* ---------- Navbar scroll state ---------- */
  const navbar = document.querySelector(".navbar");
  const onScrollNav = () => {
    if (!navbar) return;
    navbar.classList.toggle("scrolled", window.scrollY > 30);
  };
  onScrollNav();
  window.addEventListener("scroll", onScrollNav, { passive: true });

  /* ---------- Mobile menu ---------- */
  const hamburger = document.querySelector(".hamburger");
  const overlay = document.querySelector(".mobile-overlay");
  if (hamburger && overlay) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("open");
      overlay.classList.toggle("open");
      document.body.style.overflow = overlay.classList.contains("open") ? "hidden" : "";
    });
    overlay.querySelectorAll("a").forEach(a =>
      a.addEventListener("click", () => {
        hamburger.classList.remove("open");
        overlay.classList.remove("open");
        document.body.style.overflow = "";
      })
    );
  }

  /* ---------- Active nav link ---------- */
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a, .mobile-overlay a").forEach(a => {
    const href = a.getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      a.classList.add("active");
    }
  });

  /* ---------- Custom cursor ---------- */
  const isTouch = matchMedia("(pointer: coarse)").matches;
  const dot = document.querySelector(".cursor-dot");
  const ring = document.querySelector(".cursor-ring");
  if (!isTouch && dot && ring) {
    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener("mousemove", e => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + "px";
      dot.style.top = my + "px";
    });
    const animRing = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.left = rx + "px";
      ring.style.top = ry + "px";
      requestAnimationFrame(animRing);
    };
    animRing();
    document.querySelectorAll("a, button, .tilt, .project-card, input, textarea, select").forEach(el => {
      el.addEventListener("mouseenter", () => ring.classList.add("active"));
      el.addEventListener("mouseleave", () => ring.classList.remove("active"));
    });
  } else {
    document.body.classList.add("no-cursor");
  }

  /* ---------- Magnetic buttons ---------- */
  if (!isTouch) {
    document.querySelectorAll(".magnetic").forEach(el => {
      el.addEventListener("mousemove", e => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "translate(0,0)";
      });
    });
  }

  /* ---------- Button ripple ---------- */
  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", function (e) {
      const r = this.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.left = e.clientX - r.left + "px";
      ripple.style.top = e.clientY - r.top + "px";
      ripple.style.width = ripple.style.height = Math.max(r.width, r.height) + "px";
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  });

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  }

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    const countIo = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        let cur = 0;
        const step = Math.max(target / 60, 0.1);
        const tick = () => {
          cur += step;
          if (cur >= target) {
            el.textContent = target + suffix;
          } else {
            el.textContent = Math.floor(cur) + suffix;
            requestAnimationFrame(tick);
          }
        };
        tick();
        countIo.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach(el => countIo.observe(el));
  }

  /* ---------- Skill bars ---------- */
  const bars = document.querySelectorAll(".skill-bar-fill");
  if (bars.length) {
    const barIo = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.width = entry.target.dataset.value + "%";
          barIo.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    bars.forEach(el => barIo.observe(el));
  }

  /* ---------- Skill rings ---------- */
  const rings = document.querySelectorAll(".ring-fill");
  if (rings.length) {
    const ringIo = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pct = parseFloat(entry.target.dataset.value) / 100;
          const dash = 340 - 340 * pct;
          entry.target.style.strokeDashoffset = dash;
          ringIo.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    rings.forEach(el => ringIo.observe(el));
  }

  /* ---------- Card tilt ---------- */
  if (!isTouch) {
    document.querySelectorAll(".tilt").forEach(card => {
      card.addEventListener("mousemove", e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)`;
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "perspective(800px) rotateY(0) rotateX(0) translateY(0)";
      });
    });
  }

  /* ---------- Back to top ---------- */
  const backTop = document.getElementById("back-to-top");
  if (backTop) {
    window.addEventListener("scroll", () => {
      backTop.classList.toggle("show", window.scrollY > 500);
    }, { passive: true });
    backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ---------- Typing hero role effect ---------- */
  const typedEl = document.getElementById("typed");
  if (typedEl) {
    const roles = JSON.parse(typedEl.dataset.roles || "[]");
    let ri = 0, ci = 0, deleting = false;
    const typeTick = () => {
      const word = roles[ri];
      if (!deleting) {
        ci++;
        typedEl.textContent = word.slice(0, ci);
        if (ci === word.length) {
          deleting = true;
          setTimeout(typeTick, 1400);
          return;
        }
      } else {
        ci--;
        typedEl.textContent = word.slice(0, ci);
        if (ci === 0) {
          deleting = false;
          ri = (ri + 1) % roles.length;
        }
      }
      setTimeout(typeTick, deleting ? 45 : 90);
    };
    if (roles.length) typeTick();
  }

  /* ---------- Particle canvas (hero) ---------- */
  const canvas = document.getElementById("particle-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let particles = [];
    let mouse = { x: -9999, y: -9999 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 14000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.8 + 0.6
      }));
    };
    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });

    const accentA = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#00c9ff";

    const draw = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 120) {
          p.x -= dx * 0.01;
          p.y -= dy * 0.01;
        }
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = accentA;
        ctx.globalAlpha = 0.55;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 110) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = accentA;
            ctx.globalAlpha = (1 - d / 110) * 0.25;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    };
    draw();
  }

  /* ---------- Hero heading word reveal stagger ---------- */
  document.querySelectorAll(".reveal-word span").forEach((el, i) => {
    el.style.animationDelay = `${0.15 + i * 0.06}s`;
  });

  /* ---------- Project filter ---------- */
  const filterTabs = document.querySelectorAll(".filter-tabs button");
  const projectCards = document.querySelectorAll(".masonry .project-card");
  if (filterTabs.length && projectCards.length) {
    filterTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        filterTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const cat = tab.dataset.filter;
        projectCards.forEach(card => {
          const match = cat === "all" || card.dataset.category === cat;
          card.classList.toggle("hide", !match);
        });
      });
    });
  }

  /* ---------- Project modal ---------- */
  const modalOverlay = document.getElementById("project-modal");
  if (modalOverlay) {
    const modalBox = modalOverlay.querySelector(".modal-box");
    document.querySelectorAll("[data-project]").forEach(card => {
      card.addEventListener("click", () => {
        const d = card.dataset;
        modalBox.innerHTML = `
          <button class="modal-close" aria-label="Close">&times;</button>
          <img src="${d.image}" alt="${d.title}" loading="lazy">
          <h2>${d.title}</h2>
          <p>${d.desc}</p>
          <h4>Problem</h4><p>${d.problem || "Details coming soon."}</p>
          <h4>Solution</h4><p>${d.solution || "Details coming soon."}</p>
          <h4>Tech Stack</h4>
          <div class="tag-row">${(d.tech || "").split(",").map(t => `<span class="tag">${t.trim()}</span>`).join("")}</div>
          <h4>Key Features</h4>
          <ul>${(d.features || "").split("|").filter(Boolean).map(f => `<li>${f.trim()}</li>`).join("")}</ul>
          <div class="modal-links">
            <a class="btn btn-primary btn-sm" href="${d.demo || '#'}" target="_blank" rel="noopener">Live Demo</a>
            <a class="btn btn-ghost btn-sm" href="${d.repo || '#'}" target="_blank" rel="noopener">GitHub Repo</a>
          </div>
        `;
        modalOverlay.classList.add("open");
        document.body.style.overflow = "hidden";
        modalBox.querySelector(".modal-close").addEventListener("click", closeModal);
      });
    });
    function closeModal() {
      modalOverlay.classList.remove("open");
      document.body.style.overflow = "";
    }
    modalOverlay.addEventListener("click", e => {
      if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeModal();
    });
  }

  /* ---------- Timeline toggle ---------- */
  document.querySelectorAll(".timeline-item").forEach(item => {
    item.addEventListener("click", () => item.classList.toggle("open"));
  });

  /* ---------- Testimonial carousel ---------- */
  const slides = document.querySelectorAll(".testimonial-slide");
  if (slides.length) {
    let idx = 0;
    const dotsWrap = document.querySelector(".testimonial-nav");
    slides.forEach((_, i) => {
      const b = document.createElement("button");
      if (i === 0) b.classList.add("active");
      b.addEventListener("click", () => goTo(i));
      dotsWrap && dotsWrap.appendChild(b);
    });
    const dots = dotsWrap ? dotsWrap.querySelectorAll("button") : [];
    function goTo(i) {
      slides[idx].classList.remove("active");
      dots[idx] && dots[idx].classList.remove("active");
      idx = (i + slides.length) % slides.length;
      slides[idx].classList.add("active");
      dots[idx] && dots[idx].classList.add("active");
    }
    document.querySelector(".testimonial-prev")?.addEventListener("click", () => goTo(idx - 1));
    document.querySelector(".testimonial-next")?.addEventListener("click", () => goTo(idx + 1));
    let auto = setInterval(() => goTo(idx + 1), 5500);
    document.querySelector(".testimonial-track")?.addEventListener("mouseenter", () => clearInterval(auto));
  }

  /* ---------- Accordion (FAQ) ---------- */
  document.querySelectorAll(".accordion-item").forEach(item => {
    item.querySelector(".accordion-q")?.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      item.parentElement.querySelectorAll(".accordion-item").forEach(i => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });

  /* ---------- Flip cards keyboard/touch support ---------- */
  document.querySelectorAll(".flip-card").forEach(card => {
    card.addEventListener("click", () => card.classList.toggle("flipped"));
  });

  /* ---------- Floating label filled state (for select/prefilled) ---------- */
  document.querySelectorAll(".field input, .field textarea").forEach(el => {
    el.addEventListener("blur", () => {
      el.closest(".field").classList.toggle("filled", el.value.trim() !== "");
    });
  });

  /* ---------- Contact form ---------- */
  const form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      const status = document.getElementById("form-status");
      btn.classList.add("loading");
      status.textContent = "";
      setTimeout(() => {
        btn.classList.remove("loading");
        status.textContent = "Thanks! Your message has been noted (demo only — connect a backend to send for real).";
        form.reset();
        form.querySelectorAll(".field").forEach(f => f.classList.remove("filled"));
      }, 1400);
    });
  }

  /* ---------- Gallery lightbox ---------- */
  const lightbox = document.getElementById("lightbox");
  if (lightbox) {
    const lbImg = lightbox.querySelector("img");
    document.querySelectorAll("[data-lightbox]").forEach(img => {
      img.addEventListener("click", () => {
        lbImg.src = img.src;
        lbImg.alt = img.alt;
        lightbox.classList.add("open");
      });
    });
    lightbox.addEventListener("click", () => lightbox.classList.remove("open"));
  }

  /* ---------- Konami code easter egg ---------- */
  const konami = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
  let ki = 0;
  document.addEventListener("keydown", e => {
    ki = (e.key === konami[ki]) ? ki + 1 : 0;
    if (ki === konami.length) {
      ki = 0;
      const egg = document.getElementById("easter-egg");
      if (egg) {
        egg.classList.add("show");
        setTimeout(() => egg.classList.remove("show"), 3500);
      }
    }
  });

});
