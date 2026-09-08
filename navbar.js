(async () => {
  const mount = document.getElementById("global-navbar");
  if (!mount) return;

  try {
    const res = await fetch("navbar.html", { cache: "no-cache" });
    if (!res.ok) throw new Error("navbar load failed");

    mount.innerHTML = await res.text();

    const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    const page = file === "pubg.html" ? "pubg" : "main";

    const active = mount.querySelector('[data-page="' + page + '"]');
    if (active) active.classList.add("active");
  } catch (err) {
    console.error(err);
  }
})();