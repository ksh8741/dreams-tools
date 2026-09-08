(async () => {
  const mount = document.getElementById("global-navbar");
  if (!mount) return;

  try {
    const res = await fetch("navbar.html", { cache: "no-cache" });
    if (!res.ok) throw new Error("navbar load failed");

    mount.innerHTML = await res.text();

    const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();

    if (file === "pubg.html") {
      const active = mount.querySelector('[data-page="pubg"]');
      if (active) active.classList.add("active");
    }
  } catch (err) {
    console.error(err);
  }
})();
