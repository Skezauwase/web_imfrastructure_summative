// ============================================
//  ResearchRadar — trending.js  (Trending page)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    renderTrending();

    // Mouse glow effect
    const radarGlow = document.querySelector('.radar-glow');
    document.addEventListener('mousemove', (e) => {
        radarGlow.style.left = `${e.clientX}px`;
        radarGlow.style.top  = `${e.clientY}px`;
    });

    // Mobile nav toggle
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        document.getElementById('nav-links').classList.toggle('open');
    });
});

// Featured topics — shown large at the top
const featuredTopics = [
    { icon: '<i class="fa-solid fa-brain"></i>',          name: 'Large Language Models',   desc: 'Transformer architectures, GPT, BERT, and next-generation AI language systems.' },
    { icon: '<i class="fa-solid fa-dna"></i>',            name: 'CRISPR Gene Editing',     desc: 'Precision genome editing techniques and their therapeutic applications.' },
    { icon: '<i class="fa-solid fa-atom"></i>',           name: 'Quantum Computing',       desc: 'Quantum algorithms, error correction, and supremacy experiments.' },
    { icon: '<i class="fa-solid fa-globe"></i>',          name: 'Climate Change',          desc: 'Climate modeling, mitigation strategies, and environmental impact research.' },
];

// More topics — shown in a smaller grid
const moreTopics = [
    { icon: '<i class="fa-solid fa-microscope"></i>',        name: 'Cancer Immunotherapy' },
    { icon: '<i class="fa-solid fa-sun"></i>',               name: 'Renewable Energy' },
    { icon: '<i class="fa-solid fa-eye"></i>',               name: 'Computer Vision' },
    { icon: '<i class="fa-solid fa-virus"></i>',             name: 'Antibiotic Resistance' },
    { icon: '<i class="fa-solid fa-robot"></i>',             name: 'Reinforcement Learning' },
    { icon: '<i class="fa-solid fa-syringe"></i>',           name: 'mRNA Vaccines' },
    { icon: '<i class="fa-solid fa-magnet"></i>',            name: 'Nuclear Fusion' },
    { icon: '<i class="fa-solid fa-network-wired"></i>',     name: 'Blockchain Technology' },
    { icon: '<i class="fa-solid fa-flask"></i>',             name: 'Drug Discovery' },
    { icon: '<i class="fa-solid fa-flask-vial"></i>',        name: 'Stem Cell Research' },
    { icon: '<i class="fa-solid fa-satellite-dish"></i>',    name: 'Deep Space Exploration' },
    { icon: '<i class="fa-solid fa-gears"></i>',             name: 'Robotics & Automation' },
];

function renderTrending() {
    const featuredGrid = document.getElementById('featured-grid');
    const moreGrid     = document.getElementById('more-grid');

    featuredGrid.innerHTML = featuredTopics.map((t, i) => `
        <div class="trending-card trending-card-featured glass-box fade-up"
             style="animation-delay:${i * 0.08}s"
             onclick="goToDiscover('${t.name}')">
            <div class="trending-card-top">
                <span class="trending-icon">${t.icon}</span>
                <span class="trending-explore">Explore →</span>
            </div>
            <h4>${t.name}</h4>
            <p class="trending-card-desc">${t.desc}</p>
        </div>
    `).join('');

    moreGrid.innerHTML = moreTopics.map((t, i) => `
        <div class="trending-card glass-box fade-up"
             style="animation-delay:${i * 0.05}s"
             onclick="goToDiscover('${t.name}')">
            <span class="trending-icon">${t.icon}</span>
            <h4>${t.name}</h4>
            <span class="trending-explore">Explore →</span>
        </div>
    `).join('');
}

// Navigate to the Discover page with the selected topic pre-filled
function goToDiscover(topic) {
    window.location.href = `index.html?q=${encodeURIComponent(topic)}`;
}
