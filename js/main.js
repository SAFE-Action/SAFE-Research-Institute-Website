/* ============================================
   SAFE Research Institute - Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // --- Mobile Navigation Toggle ---
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      // Animate hamburger
      const spans = navToggle.querySelectorAll('span');
      if (navLinks.classList.contains('active')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    });

    // Close mobile nav when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        const spans = navToggle.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      });
    });
  }

  // --- Task Force Conditional Fields ---
  const taskForceSelect = document.getElementById('taskForceSelect');
  if (taskForceSelect) {
    const allConditional = document.querySelectorAll('.conditional-fields');

    taskForceSelect.addEventListener('change', () => {
      // Hide all conditional fields
      allConditional.forEach(el => el.classList.remove('active'));

      // Show matching fields
      const val = taskForceSelect.value;
      const target = document.getElementById(`fields-${val}`);
      if (target) {
        target.classList.add('active');
      }
    });
  }

  // --- Smooth Scroll for Anchor Links ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.scrollY - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // --- Header Scroll Effect ---
  const header = document.querySelector('.site-header');
  if (header) {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      if (currentScroll > 100) {
        header.style.boxShadow = '0 4px 30px rgba(0,0,0,0.15)';
      } else {
        header.style.boxShadow = '';
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

  // --- Intersection Observer for Fade-in Animations ---
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        fadeObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Apply to cards and sections
  const animateElements = document.querySelectorAll(
    '.pillar-card, .taskforce-card, .content-card, .why-feature, .commitment-card, .why-visual-card'
  );
  animateElements.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `opacity 0.6s ease ${i % 3 * 0.15}s, transform 0.6s ease ${i % 3 * 0.15}s`;
    fadeObserver.observe(el);
  });

  // --- Marquee Pause on Hover ---
  const marqueeBar = document.querySelector('.marquee-bar');
  const marqueeTrack = document.querySelector('.marquee-track');
  if (marqueeBar && marqueeTrack) {
    marqueeBar.addEventListener('mouseenter', () => {
      marqueeTrack.style.animationPlayState = 'paused';
    });
    marqueeBar.addEventListener('mouseleave', () => {
      marqueeTrack.style.animationPlayState = 'running';
    });
  }

});
