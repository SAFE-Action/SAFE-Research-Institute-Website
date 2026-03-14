/**
 * SAFE Research Institute — Volunteer Onboarding Automation
 *
 * Google Apps Script deployed as a web app webhook.
 * Called from the admin panel when a volunteer is approved.
 *
 * SETUP INSTRUCTIONS:
 * 1. Open Google Apps Script (script.google.com) in your SAFE Workspace account
 * 2. Create a new project, paste this code
 * 3. Update the CONFIG section below with your values
 * 4. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone (so the website can call it)
 * 5. Copy the deployed URL and paste it into js/volunteer-admin.js as GAS_WEBHOOK_URL
 * 6. Enable the Google Chat API and Calendar API in your Apps Script project:
 *    - Services > Add > Google Chat API
 *    - Services > Add > Google Calendar API
 */

// ============================================
// CONFIGURATION — Update these values
// ============================================

const CONFIG = {
  // Shared secret for authenticating webhook calls (must match volunteer-admin.js)
  SHARED_SECRET: 'YOUR_SHARED_SECRET_HERE',

  // Google Chat space resource name
  // Find this in Google Chat > Space settings > Space details
  // Format: spaces/XXXXXXXXX
  CHAT_SPACE_NAME: 'spaces/YOUR_SPACE_ID',

  // Google Calendar ID for SAFE meetings
  // Usually the calendar's email address, e.g., safe-meetings@group.calendar.google.com
  CALENDAR_ID: 'YOUR_CALENDAR_ID@group.calendar.google.com',

  // Admin notification email
  ADMIN_EMAIL: 'admin@saferesearch.org',

  // Meeting schedule
  MEETING_DAY_OF_WEEK: CalendarApp.Weekday.TUESDAY,  // Change to your meeting day
  MEETING_START_HOUR: 18,   // 6 PM (24-hour format)
  MEETING_DURATION_AGENDA: 60,   // minutes
  MEETING_DURATION_WORKING: 60,  // minutes
  MEETING_TIMEZONE: 'America/New_York',

  // Google Meet link (if you have a recurring Meet link)
  GOOGLE_MEET_LINK: 'https://meet.google.com/YOUR_MEETING_LINK'
};


// ============================================
// WEB APP ENTRY POINT
// ============================================

/**
 * Handles POST requests from the admin panel.
 * @param {Object} e - The event object from the web app.
 * @returns {TextOutput} JSON response.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // Validate shared secret
    if (payload.secret !== CONFIG.SHARED_SECRET) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Validate payload
    if (!payload.action || !payload.volunteer) {
      return jsonResponse({ success: false, error: 'Missing required fields' }, 400);
    }

    if (payload.action === 'onboard') {
      return handleOnboard(payload.volunteer);
    }

    return jsonResponse({ success: false, error: 'Unknown action' }, 400);

  } catch (err) {
    Logger.log('Error in doPost: ' + err.message);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

/**
 * Handles GET requests (for testing the deployment).
 */
function doGet() {
  return jsonResponse({
    status: 'ok',
    service: 'SAFE Volunteer Onboarding Webhook',
    timestamp: new Date().toISOString()
  });
}


// ============================================
// ONBOARDING HANDLER
// ============================================

/**
 * Processes a volunteer onboarding request.
 * @param {Object} volunteer - Volunteer data from the admin panel.
 * @returns {TextOutput} JSON response with results.
 */
function handleOnboard(volunteer) {
  const results = {
    chatInvite: false,
    calendarInvite: false,
    welcomeEmail: false
  };

  const errors = [];

  // 1. Add to Google Chat space
  try {
    addToChatSpace(volunteer.email, volunteer.fullName);
    results.chatInvite = true;
  } catch (err) {
    Logger.log('Chat invite error: ' + err.message);
    errors.push('Chat: ' + err.message);
  }

  // 2. Create calendar invite
  try {
    createCalendarInvite(volunteer.email, volunteer.fullName, volunteer.meetingAvailability);
    results.calendarInvite = true;
  } catch (err) {
    Logger.log('Calendar invite error: ' + err.message);
    errors.push('Calendar: ' + err.message);
  }

  // 3. Send welcome email (backup — primary is via EmailJS)
  try {
    sendWelcomeEmail(volunteer);
    results.welcomeEmail = true;
  } catch (err) {
    Logger.log('Welcome email error: ' + err.message);
    errors.push('Email: ' + err.message);
  }

  const allSucceeded = results.chatInvite && results.calendarInvite && results.welcomeEmail;

  return jsonResponse({
    success: allSucceeded,
    results: results,
    errors: errors.length > 0 ? errors : undefined
  });
}


// ============================================
// GOOGLE CHAT INTEGRATION
// ============================================

/**
 * Adds a volunteer to the SAFE Google Chat space.
 * Requires Chat API to be enabled in Apps Script services.
 *
 * @param {string} email - Volunteer's email address.
 * @param {string} name - Volunteer's full name.
 */
function addToChatSpace(email, name) {
  const url = 'https://chat.googleapis.com/v1/' + CONFIG.CHAT_SPACE_NAME + '/members';

  const memberPayload = {
    member: {
      name: 'users/' + email,
      type: 'HUMAN'
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(memberPayload),
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 200 && statusCode !== 201) {
    const body = JSON.parse(response.getContentText());
    // 409 means already a member — that's okay
    if (statusCode === 409) {
      Logger.log(email + ' is already a member of the chat space');
      return;
    }
    throw new Error('Chat API returned ' + statusCode + ': ' + (body.error?.message || 'Unknown error'));
  }

  Logger.log('Added ' + email + ' to chat space');
}


// ============================================
// GOOGLE CALENDAR INTEGRATION
// ============================================

/**
 * Creates a recurring calendar event invitation for the volunteer.
 * Sends two meeting invitations based on their availability preference.
 *
 * @param {string} email - Volunteer's email.
 * @param {string} name - Volunteer's name.
 * @param {string} availability - "both", "agenda-only", or "working-only".
 */
function createCalendarInvite(email, name, availability) {
  const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  if (!calendar) {
    throw new Error('Calendar not found. Check CALENDAR_ID in config.');
  }

  // Find the next occurrence of the meeting day
  const now = new Date();
  const nextMeetingDate = getNextWeekday(now, CONFIG.MEETING_DAY_OF_WEEK);

  // Create agenda meeting invite (1st hour)
  if (availability === 'both' || availability === 'agenda-only') {
    const agendaStart = new Date(nextMeetingDate);
    agendaStart.setHours(CONFIG.MEETING_START_HOUR, 0, 0, 0);

    const agendaEnd = new Date(agendaStart);
    agendaEnd.setMinutes(agendaEnd.getMinutes() + CONFIG.MEETING_DURATION_AGENDA);

    const agendaEvent = calendar.createEventSeries(
      'SAFE Team Meeting — Agenda',
      agendaStart,
      agendaEnd,
      CalendarApp.newRecurrence().addWeeklyRule().onlyOnWeekday(CONFIG.MEETING_DAY_OF_WEEK),
      {
        description: 'Weekly SAFE Research Institute team meeting.\n\n' +
                     'First hour: Agenda-based discussion.\n' +
                     'Join via Google Meet: ' + CONFIG.GOOGLE_MEET_LINK + '\n\n' +
                     'If you cannot attend, please review the meeting minutes.',
        guests: email,
        sendInvites: true
      }
    );

    Logger.log('Created agenda meeting series for ' + email);
  }

  // Create working session invite (2nd hour)
  if (availability === 'both' || availability === 'working-only') {
    const workingStart = new Date(nextMeetingDate);
    workingStart.setHours(CONFIG.MEETING_START_HOUR + 1, 0, 0, 0);

    const workingEnd = new Date(workingStart);
    workingEnd.setMinutes(workingEnd.getMinutes() + CONFIG.MEETING_DURATION_WORKING);

    const workingEvent = calendar.createEventSeries(
      'SAFE Working Session (Optional)',
      workingStart,
      workingEnd,
      CalendarApp.newRecurrence().addWeeklyRule().onlyOnWeekday(CONFIG.MEETING_DAY_OF_WEEK),
      {
        description: 'Optional weekly working session for SAFE task force members.\n\n' +
                     'Second hour: Collaborative work on current projects.\n' +
                     'Join via Google Meet: ' + CONFIG.GOOGLE_MEET_LINK,
        guests: email,
        sendInvites: true
      }
    );

    Logger.log('Created working session series for ' + email);
  }
}

/**
 * Returns the next occurrence of a given weekday.
 * @param {Date} fromDate - Starting date.
 * @param {CalendarApp.Weekday} weekday - Target weekday.
 * @returns {Date} Next occurrence of that weekday.
 */
function getNextWeekday(fromDate, weekday) {
  const weekdayMap = {
    [CalendarApp.Weekday.SUNDAY]: 0,
    [CalendarApp.Weekday.MONDAY]: 1,
    [CalendarApp.Weekday.TUESDAY]: 2,
    [CalendarApp.Weekday.WEDNESDAY]: 3,
    [CalendarApp.Weekday.THURSDAY]: 4,
    [CalendarApp.Weekday.FRIDAY]: 5,
    [CalendarApp.Weekday.SATURDAY]: 6
  };

  const targetDay = weekdayMap[weekday];
  const currentDay = fromDate.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) daysUntil += 7;

  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + daysUntil);
  return nextDate;
}


// ============================================
// WELCOME EMAIL
// ============================================

/**
 * Sends a welcome email to the approved volunteer.
 * This is a backup — the primary email is sent via EmailJS from the admin panel.
 *
 * @param {Object} volunteer - Volunteer data.
 */
function sendWelcomeEmail(volunteer) {
  const taskGroupNames = {
    'advocates': 'Advocates — Public Outreach and Communications',
    'digital': 'Digital — Website, Data, and Technical Infrastructure',
    'experts': 'Experts — Legislation Analysis',
    'general': 'General Volunteer'
  };

  const groupName = taskGroupNames[volunteer.taskGroup] || volunteer.taskGroup;

  const subject = 'Welcome to the SAFE Research Institute!';

  const htmlBody = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2c3e50;">
      <div style="background: #0a1628; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: #c8a855; margin: 0; font-size: 24px;">SAFE Research Institute</h1>
        <p style="color: #8899aa; margin: 8px 0 0;">Science And Freedom for Everyone</p>
      </div>

      <div style="padding: 32px; background: #ffffff; border: 1px solid #f0f2f5;">
        <h2 style="color: #0a1628; margin: 0 0 16px;">Welcome, ${volunteer.fullName}!</h2>

        <p>Your volunteer application has been approved. We're excited to have you join the SAFE team!</p>

        <h3 style="color: #0a1628; margin: 24px 0 8px;">Your Task Group</h3>
        <p style="background: #f8f9fb; padding: 12px 16px; border-radius: 6px; border-left: 3px solid #c8a855;">
          <strong>${groupName}</strong>
        </p>

        <h3 style="color: #0a1628; margin: 24px 0 8px;">What to Expect</h3>
        <ul style="line-height: 1.8; padding-left: 20px;">
          <li><strong>Time commitment:</strong> ~5 hours per month</li>
          <li><strong>Weekly meetings:</strong> 1st hour is agenda-based, 2nd hour is an optional working session</li>
          <li>If you can't attend, please review the meeting minutes document</li>
        </ul>

        <h3 style="color: #0a1628; margin: 24px 0 8px;">Next Steps</h3>
        <ol style="line-height: 1.8; padding-left: 20px;">
          <li>Check your calendar for the meeting invitations</li>
          <li>Accept the Google Chat space invitation to connect with the team</li>
          <li>Review the meeting minutes from recent sessions</li>
          <li>Introduce yourself in the Google Chat space!</li>
        </ol>
      </div>

      <div style="background: #f8f9fb; padding: 24px 32px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #f0f2f5; border-top: none;">
        <p style="color: #8899aa; font-size: 12px; margin: 0;">
          SAFE Research Institute | Science And Freedom for Everyone<br>
          This email was sent as part of the volunteer onboarding process.
        </p>
      </div>
    </div>
  `;

  GmailApp.sendEmail(volunteer.email, subject, '', {
    htmlBody: htmlBody,
    name: 'SAFE Research Institute',
    replyTo: CONFIG.ADMIN_EMAIL
  });

  Logger.log('Welcome email sent to ' + volunteer.email);
}


// ============================================
// UTILITY
// ============================================

/**
 * Creates a JSON response for the web app.
 * @param {Object} data - Response data.
 * @param {number} [statusCode=200] - HTTP status code (informational only).
 * @returns {TextOutput} JSON text output.
 */
function jsonResponse(data, statusCode) {
  // Note: Apps Script web apps always return 200, but we include status in the body
  data._statusCode = statusCode || 200;
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
