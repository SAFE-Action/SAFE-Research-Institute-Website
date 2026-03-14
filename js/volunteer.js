/* ============================================
   SAFE Research Institute - Volunteer Onboarding
   Multi-step form with signature pad, legitimacy
   scoring, EmailJS notifications, and Firestore.
   ============================================ */

import { db, auth } from './firebase-config.js';
import { signInWithGoogle, logOut, onAuth } from './auth.js';
import {
  collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// --- EmailJS Config (placeholders) ---
const EMAILJS_PUBLIC_KEY = 'YOUR_EMAILJS_PUBLIC_KEY';
const EMAILJS_SERVICE_ID = 'YOUR_EMAILJS_SERVICE_ID';
const EMAILJS_ADMIN_TEMPLATE_ID = 'YOUR_ADMIN_NOTIFICATION_TEMPLATE';

// --- DOM References ---
const authGate = document.getElementById('authGate');
const volunteerForm = document.getElementById('volunteerForm');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const onboardingForm = document.getElementById('volOnboardingForm');
const successState = document.getElementById('volSuccess');
const submitBtn = document.getElementById('volSubmitBtn');
const taskGroupSelect = document.getElementById('volTaskGroup');
const clearSignatureBtn = document.getElementById('clearSignatureBtn');
const signatureCanvas = document.getElementById('signatureCanvas');

// --- State ---
let currentUser = null;
let currentStep = 1;
const totalSteps = 4;
let signatureCtx = null;
let isDrawing = false;
let hasDrawn = false;
let resumeBase64 = null;
let resumeFileName = null;

// =========================================
// AUTH
// =========================================

onAuth(async (user) => {
  currentUser = user;

  if (user) {
    authGate.style.display = 'none';
    volunteerForm.style.display = '';

    userPhoto.src = user.photoURL || '';
    userPhoto.alt = user.displayName || 'User';
    userName.textContent = user.displayName || 'Volunteer';
    userEmail.textContent = user.email || '';

    // Pre-fill email if empty
    const emailInput = document.getElementById('volEmail');
    if (emailInput && !emailInput.value) {
      emailInput.value = user.email || '';
    }

    // Pre-fill name if empty
    const nameInput = document.getElementById('volFullName');
    if (nameInput && !nameInput.value && user.displayName) {
      nameInput.value = user.displayName;
    }

    // Check URL params for pre-selected group
    readUrlParams();

    // Initialize signature pad
    initSignaturePad();
  } else {
    authGate.style.display = '';
    volunteerForm.style.display = 'none';
  }
});

googleSignInBtn.addEventListener('click', async () => {
  try {
    await signInWithGoogle();
  } catch (err) {
    console.error('Sign-in failed:', err);
  }
});

signOutBtn.addEventListener('click', async () => {
  try {
    await logOut();
  } catch (err) {
    console.error('Sign-out failed:', err);
  }
});

// =========================================
// URL PARAMS
// =========================================

function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const group = params.get('group');
  if (group && taskGroupSelect) {
    const validGroups = ['advocates', 'digital', 'experts', 'general'];
    if (validGroups.includes(group.toLowerCase())) {
      taskGroupSelect.value = group.toLowerCase();
      updateConditionalFields();
    }
  }
}

// =========================================
// STEP NAVIGATION
// =========================================

function showStep(n) {
  const steps = document.querySelectorAll('.vol-step');
  const progressSteps = document.querySelectorAll('.vol-progress-step');
  const connectors = document.querySelectorAll('.vol-progress-connector');

  steps.forEach((step, i) => {
    step.classList.toggle('active', i === n - 1);
  });

  progressSteps.forEach((ps, i) => {
    const stepNum = i + 1;
    ps.classList.remove('active', 'completed');
    if (stepNum < n) {
      ps.classList.add('completed');
    } else if (stepNum === n) {
      ps.classList.add('active');
    }
  });

  connectors.forEach((conn, i) => {
    conn.classList.toggle('completed', i < n - 1);
  });

  currentStep = n;

  // Scroll to top of form
  const formContainer = document.querySelector('.vol-progress');
  if (formContainer) {
    formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Expose to global scope for inline onclick handlers
window.nextStep = function () {
  if (validateStep(currentStep)) {
    if (currentStep < totalSteps) {
      showStep(currentStep + 1);
    }
  }
};

window.prevStep = function () {
  if (currentStep > 1) {
    showStep(currentStep - 1);
  }
};

// =========================================
// VALIDATION
// =========================================

function validateStep(n) {
  clearValidationErrors();

  switch (n) {
    case 1:
      return validateStep1();
    case 2:
      return validateStep2();
    case 3:
      return validateStep3();
    case 4:
      return validateStep4();
    default:
      return true;
  }
}

function validateStep1() {
  let valid = true;
  const fields = [
    { id: 'volFullName', msg: 'Full legal name is required' },
    { id: 'volEmail', msg: 'Valid email address is required' },
    { id: 'volLocation', msg: 'City and state is required' },
    { id: 'volTitle', msg: 'Professional title is required' }
  ];

  fields.forEach(({ id, msg }) => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      markInvalid(el, msg);
      valid = false;
    }
  });

  // Validate email format
  const emailEl = document.getElementById('volEmail');
  if (emailEl.value.trim() && !isValidEmail(emailEl.value.trim())) {
    markInvalid(emailEl, 'Please enter a valid email address');
    valid = false;
  }

  return valid;
}

function validateStep2() {
  let valid = true;

  const taskGroup = document.getElementById('volTaskGroup');
  if (!taskGroup.value) {
    markInvalid(taskGroup, 'Please select a task group');
    valid = false;
  }

  const experience = document.getElementById('volExperience');
  if (!experience.value.trim()) {
    markInvalid(experience, 'Relevant experience summary is required');
    valid = false;
  }

  return valid;
}

function validateStep3() {
  let valid = true;

  const commitCheck = document.getElementById('volCommitConfirm');
  if (!commitCheck.checked) {
    markInvalid(commitCheck, 'You must confirm the commitment expectations');
    valid = false;
  }

  const meetingAvail = document.querySelector('input[name="volMeetingAvail"]:checked');
  if (!meetingAvail) {
    const container = document.querySelector('input[name="volMeetingAvail"]');
    if (container) {
      markInvalid(container, 'Please select your meeting availability');
    }
    valid = false;
  }

  return valid;
}

function validateStep4() {
  let valid = true;

  const checks = ['volCheckCOI', 'volCheckConf', 'volCheckNP'];
  checks.forEach((id) => {
    const el = document.getElementById(id);
    if (!el.checked) {
      markInvalid(el, 'This acknowledgment is required');
      valid = false;
    }
  });

  // Validate signature
  if (!hasDrawn || isCanvasBlank()) {
    const canvas = document.getElementById('signatureCanvas');
    markInvalid(canvas, 'Your digital signature is required');
    valid = false;
  }

  return valid;
}

function markInvalid(el, msg) {
  el.classList.add('is-invalid');

  // Add error message if not already present
  let errorEl = el.parentElement.querySelector('.vol-field-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'vol-field-error';
    errorEl.style.cssText = 'color:var(--red-accent);font-size:0.82rem;margin-top:4px;';
    el.parentElement.appendChild(errorEl);
  }
  errorEl.textContent = msg;
}

function clearValidationErrors() {
  document.querySelectorAll('.is-invalid').forEach((el) => {
    el.classList.remove('is-invalid');
  });
  document.querySelectorAll('.vol-field-error').forEach((el) => {
    el.remove();
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// =========================================
// CONDITIONAL FIELDS
// =========================================

taskGroupSelect.addEventListener('change', updateConditionalFields);

function updateConditionalFields() {
  const val = taskGroupSelect.value;
  const groups = ['advocates', 'digital', 'experts'];

  groups.forEach((g) => {
    const container = document.getElementById('fields-' + g);
    if (container) {
      container.classList.toggle('active', val === g);
    }
  });
}

// =========================================
// SIGNATURE PAD
// =========================================

function initSignaturePad() {
  if (!signatureCanvas) return;

  signatureCtx = signatureCanvas.getContext('2d');

  // Set canvas dimensions based on display size
  resizeCanvas();

  // Fill white background
  fillCanvasWhite();

  // Mouse events
  signatureCanvas.addEventListener('mousedown', startDrawing);
  signatureCanvas.addEventListener('mousemove', draw);
  signatureCanvas.addEventListener('mouseup', stopDrawing);
  signatureCanvas.addEventListener('mouseleave', stopDrawing);

  // Touch events
  signatureCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  signatureCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  signatureCanvas.addEventListener('touchend', stopDrawing);

  // Window resize
  window.addEventListener('resize', () => {
    // Only resize if signature hasn't been drawn
    if (!hasDrawn) {
      resizeCanvas();
      fillCanvasWhite();
    }
  });
}

function resizeCanvas() {
  const rect = signatureCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  signatureCanvas.width = rect.width * dpr;
  signatureCanvas.height = rect.height * dpr;
  signatureCtx.scale(dpr, dpr);
}

function fillCanvasWhite() {
  signatureCtx.fillStyle = '#ffffff';
  signatureCtx.fillRect(0, 0, signatureCanvas.width, signatureCanvas.height);
}

function getCanvasPos(e) {
  const rect = signatureCanvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function startDrawing(e) {
  isDrawing = true;
  hasDrawn = true;
  const pos = getCanvasPos(e);
  signatureCtx.beginPath();
  signatureCtx.moveTo(pos.x, pos.y);
  signatureCtx.strokeStyle = '#0a1628';
  signatureCtx.lineWidth = 2;
  signatureCtx.lineCap = 'round';
  signatureCtx.lineJoin = 'round';
}

function draw(e) {
  if (!isDrawing) return;
  const pos = getCanvasPos(e);
  signatureCtx.lineTo(pos.x, pos.y);
  signatureCtx.stroke();
}

function stopDrawing() {
  isDrawing = false;
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  signatureCanvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  signatureCanvas.dispatchEvent(mouseEvent);
}

function clearSignature() {
  if (!signatureCtx) return;
  signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
  fillCanvasWhite();
  hasDrawn = false;
}

clearSignatureBtn.addEventListener('click', clearSignature);

function isCanvasBlank() {
  if (!signatureCanvas) return true;
  const ctx = signatureCanvas.getContext('2d');
  const pixelData = ctx.getImageData(0, 0, signatureCanvas.width, signatureCanvas.height).data;
  // Check if all pixels are white (255,255,255,255)
  for (let i = 0; i < pixelData.length; i += 4) {
    if (pixelData[i] !== 255 || pixelData[i + 1] !== 255 || pixelData[i + 2] !== 255) {
      return false;
    }
  }
  return true;
}

function getSignatureDataUrl() {
  if (!signatureCanvas || !hasDrawn || isCanvasBlank()) return null;
  return signatureCanvas.toDataURL('image/png');
}

// =========================================
// RESUME UPLOAD
// =========================================

const resumeInput = document.getElementById('volResume');
if (resumeInput) {
  resumeInput.addEventListener('change', () => handleResumeUpload(resumeInput));
}

function handleResumeUpload(fileInput) {
  resumeBase64 = null;
  resumeFileName = null;

  const file = fileInput.files[0];
  if (!file) return;

  // Validate file size (1MB = 1048576 bytes)
  if (file.size > 1048576) {
    markInvalid(fileInput, 'File size must be less than 1MB');
    fileInput.value = '';
    return;
  }

  // Validate file type
  const validTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (!validTypes.includes(file.type)) {
    markInvalid(fileInput, 'Please upload a .pdf, .doc, or .docx file');
    fileInput.value = '';
    return;
  }

  resumeFileName = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    resumeBase64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

// =========================================
// LEGITIMACY SCORE
// =========================================

function computeLegitimacyScore(formData) {
  let score = 0;
  const breakdown = {};

  // 1. Professional email (+2)
  const freeEmails = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
  const emailDomain = (formData.email || '').split('@')[1] || '';
  const isProfessionalEmail = emailDomain && !freeEmails.includes(emailDomain.toLowerCase());
  if (isProfessionalEmail) {
    score += 2;
    breakdown.professionalEmail = { points: 2, label: 'Professional email domain' };
  } else {
    breakdown.professionalEmail = { points: 0, label: 'Professional email domain' };
  }

  // 2. LinkedIn provided (+2)
  if (formData.linkedin && formData.linkedin.trim()) {
    score += 2;
    breakdown.linkedin = { points: 2, label: 'LinkedIn profile provided' };
  } else {
    breakdown.linkedin = { points: 0, label: 'LinkedIn profile provided' };
  }

  // 3. Resume uploaded (+2)
  if (formData.resumeBase64) {
    score += 2;
    breakdown.resume = { points: 2, label: 'Resume/CV uploaded' };
  } else {
    breakdown.resume = { points: 0, label: 'Resume/CV uploaded' };
  }

  // 4. All optional fields filled (+1)
  const optionalsFilled = [
    formData.phone,
    formData.organization,
    formData.linkedin,
    formData.skills,
    formData.hearAbout
  ].every((v) => v && v.trim());
  if (optionalsFilled) {
    score += 1;
    breakdown.optionalFields = { points: 1, label: 'All optional fields completed' };
  } else {
    breakdown.optionalFields = { points: 0, label: 'All optional fields completed' };
  }

  // 5. Relevant title (+1)
  const relevantTitles = [
    'md', 'phd', 'do', 'jd', 'rn', 'np', 'pa', 'mph', 'drph', 'pharmd',
    'professor', 'researcher', 'scientist', 'analyst', 'attorney', 'director'
  ];
  const titleLower = (formData.professionalTitle || '').toLowerCase();
  const hasRelevantTitle = relevantTitles.some((t) => titleLower.includes(t));
  if (hasRelevantTitle) {
    score += 1;
    breakdown.relevantTitle = { points: 1, label: 'Relevant professional title' };
  } else {
    breakdown.relevantTitle = { points: 0, label: 'Relevant professional title' };
  }

  // 6. Experience depth (+1 for >50 words, +2 for >120 words)
  const expWords = (formData.experience || '').trim().split(/\s+/).filter(Boolean).length;
  if (expWords > 120) {
    score += 2;
    breakdown.experienceDepth = { points: 2, label: 'Detailed experience summary (120+ words)' };
  } else if (expWords > 50) {
    score += 1;
    breakdown.experienceDepth = { points: 1, label: 'Experience summary (50+ words)' };
  } else {
    breakdown.experienceDepth = { points: 0, label: 'Experience summary depth' };
  }

  return { score, breakdown };
}

// =========================================
// FORM SUBMISSION
// =========================================

onboardingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await handleSubmit();
});

async function handleSubmit() {
  // Validate final step
  if (!validateStep(4)) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    // Collect all form data
    const formData = collectFormData();

    // Compute legitimacy score
    const { score, breakdown } = computeLegitimacyScore(formData);

    // Prepare Firestore document
    const docData = {
      // Personal Info
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone || '',
      location: formData.location,
      professionalTitle: formData.professionalTitle,
      organization: formData.organization || '',
      linkedin: formData.linkedin || '',
      resumeBase64: formData.resumeBase64 || '',
      resumeFileName: formData.resumeFileName || '',

      // Experience
      taskGroup: formData.taskGroup,
      experience: formData.experience,
      skills: formData.skills || '',

      // Conditional fields
      outreachExperience: formData.outreachExperience || '',
      publicSpeaking: formData.publicSpeaking || false,
      techSkills: formData.techSkills || [],
      portfolioUrl: formData.portfolioUrl || '',
      legislativeExperience: formData.legislativeExperience || '',
      policyAreas: formData.policyAreas || [],

      // Commitment
      meetingAvailability: formData.meetingAvailability,
      hearAbout: formData.hearAbout || '',

      // Agreement
      coiAcknowledged: true,
      confidentialityAgreed: true,
      nonPartisanPledge: true,
      signatureDataUrl: formData.signatureDataUrl,

      // Scoring
      legitimacyScore: score,
      legitimacyBreakdown: breakdown,

      // Meta
      status: 'pending',
      submittedBy: currentUser ? currentUser.uid : null,
      submittedByEmail: currentUser ? currentUser.email : null,
      submittedAt: serverTimestamp(),
      adminNotes: '',
      reviewedAt: null,
      reviewedBy: null
    };

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'volunteers'), docData);

    // Send admin notification via EmailJS
    try {
      if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_ADMIN_TEMPLATE_ID, {
          volunteer_name: formData.fullName,
          volunteer_email: formData.email,
          task_group: formData.taskGroup,
          legitimacy_score: score,
          application_id: docRef.id
        });
      }
    } catch (emailErr) {
      console.warn('EmailJS notification failed (non-critical):', emailErr);
    }

    // Show success state
    onboardingForm.style.display = 'none';
    document.querySelector('.vol-progress').style.display = 'none';
    successState.style.display = '';
    successState.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    console.error('Error submitting volunteer application:', err);
    alert('There was an error submitting your application. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Application';
  }
}

function collectFormData() {
  // Tech skills checkboxes
  const techSkills = Array.from(
    document.querySelectorAll('input[name="techSkills"]:checked')
  ).map((cb) => cb.value);

  // Policy areas checkboxes
  const policyAreas = Array.from(
    document.querySelectorAll('input[name="policyAreas"]:checked')
  ).map((cb) => cb.value);

  // Meeting availability
  const meetingRadio = document.querySelector('input[name="volMeetingAvail"]:checked');

  return {
    fullName: document.getElementById('volFullName').value.trim(),
    email: document.getElementById('volEmail').value.trim(),
    phone: document.getElementById('volPhone').value.trim(),
    location: document.getElementById('volLocation').value.trim(),
    professionalTitle: document.getElementById('volTitle').value.trim(),
    organization: document.getElementById('volOrganization').value.trim(),
    linkedin: document.getElementById('volLinkedin').value.trim(),
    resumeBase64: resumeBase64,
    resumeFileName: resumeFileName,
    taskGroup: document.getElementById('volTaskGroup').value,
    experience: document.getElementById('volExperience').value.trim(),
    skills: document.getElementById('volSkills').value.trim(),
    outreachExperience: document.getElementById('volOutreachExp').value.trim(),
    publicSpeaking: document.getElementById('volPublicSpeaking').checked,
    techSkills: techSkills,
    portfolioUrl: document.getElementById('volPortfolio').value.trim(),
    legislativeExperience: document.getElementById('volLegislativeExp').value.trim(),
    policyAreas: policyAreas,
    meetingAvailability: meetingRadio ? meetingRadio.value : '',
    hearAbout: document.getElementById('volHearAbout').value.trim(),
    signatureDataUrl: getSignatureDataUrl()
  };
}
