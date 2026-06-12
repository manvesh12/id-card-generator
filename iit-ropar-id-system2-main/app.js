/* IIT Ropar Intern Attendance & ID Card System - Application Logic */

// Global State
let interns = [];
let attendanceLogs = [];
let activePhotoInternId = null;
let activeWebcamStream = null;
let cardRotations = {}; // 'front' or 'back' for each internId
const EMPTY_VALUE = "-";

// Preset mock data for demonstration
const mockInterns = [
    {
        internId: "IITR-INT-2201",
        name: "Abhishek Sharma",
        fatherName: "Sh. Rajesh Sharma",
        dob: "2002-04-15",
        department: "Computer Science & Eng.",
        issueDate: "2026-05-01",
        validUpto: "2026-07-31",
        phone: "9876543210",
        address: "C-114, SAB, IIT ROPAR, Rupnagar, Punjab - 140001",
        bloodGroup: "O+",
        email: "abhishek.sharma@iitrpr.ac.in",
        emergencyContact: "9876543211",
        mentor: "Dr. Sudarshan Iyengar",
        photo: "" // Will display placeholder
    },
    {
        internId: "IITR-INT-2202",
        name: "Priya Patel",
        fatherName: "Sh. Hasmukh Patel",
        dob: "2003-08-22",
        department: "SEnSRS Centre",
        issueDate: "2026-05-15",
        validUpto: "2026-07-15",
        phone: "9988776655",
        address: "SEnSRS Office, SAB, IIT Ropar, Rupnagar - 140001",
        bloodGroup: "A+",
        email: "priya.patel@iitrpr.ac.in",
        emergencyContact: "9988776650",
        mentor: "Dr. Subodh Kumar",
        photo: ""
    }
];

// Helper: Normalize common date inputs to YYYY-MM-DD.
function normalizeDate(value) {
    if (value === null || value === undefined || value === "") return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, "0");
        const day = String(value.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    if (typeof value === "number" && Number.isFinite(value) && typeof XLSX !== "undefined") {
        const parsed = XLSX?.SSF?.parse_date_code?.(value);
        if (parsed) {
            return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        }
    }

    const raw = String(value).trim();
    if (!raw || raw.includes("#")) return "";

    const normalized = raw.replace(/[./]/g, "-");
    const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    }

    const indianMatch = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (indianMatch) {
        return `${indianMatch[3]}-${indianMatch[2].padStart(2, "0")}-${indianMatch[1].padStart(2, "0")}`;
    }

    return raw;
}

function extractGoogleDriveFileId(url) {
    if (!url) return "";

    const text = String(url).trim();
    const filePathMatch = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (filePathMatch) return filePathMatch[1];

    const idParamMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch) return idParamMatch[1];

    const openIdMatch = text.match(/open\?id=([a-zA-Z0-9_-]+)/);
    if (openIdMatch) return openIdMatch[1];

    return "";
}

function normalizePhotoSource(value) {
    const photo = String(value || "").trim();
    if (!photo) return "";

    if (photo.startsWith("data:") || photo.startsWith("http")) {
        const driveId = extractGoogleDriveFileId(photo);
        if (driveId) {
            return `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
        }
        return photo;
    }

    if (photo.startsWith("/9j/") || photo.startsWith("iVBORw0K")) {
        return `data:image/jpeg;base64,${photo}`;
    }

    return `data:image/jpeg;base64,${photo}`;
}

// Helper: Format Date String (YYYY-MM-DD or DD-MM-YYYY to DD-MM-YYYY)
function formatDate(dateStr) {
    const normalized = normalizeDate(dateStr);
    if (!normalized) return EMPTY_VALUE;

    const parts = normalized.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return normalized;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    // Load data from localStorage
    const storedInterns = localStorage.getItem("iitr_interns");
    const storedLogs = localStorage.getItem("iitr_attendance_logs");

    if (storedInterns) {
        interns = JSON.parse(storedInterns);
    } else {
        // Pre-populate mock data for first-time use
        interns = [...mockInterns];
        localStorage.setItem("iitr_interns", JSON.stringify(interns));
    }

    if (storedLogs) {
        attendanceLogs = JSON.parse(storedLogs);
    } else {
        attendanceLogs = [];
        localStorage.setItem("iitr_attendance_logs", JSON.stringify(attendanceLogs));
    }

    // Initialize Lucide Icons
    lucide.createIcons();

    // Setup Event Listeners
    setupDragAndDrop();
    setupPhotoInputs();
    
    // Set default date filter in Admin Logs to today
    document.getElementById("log-date-filter").value = getLocalDateString();

    // Initial render
    refreshAllViews();

    // Auto-focus terminal input
    setTimeout(() => {
        const input = document.getElementById("terminal-id-input");
        if (input) input.focus();
    }, 500);
});

// Helper: Get Current Local Date String (YYYY-MM-DD)
function getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper: Format Time String (HH:MM AM/PM)
function formatTime(dateObj) {
    let hours = dateObj.getHours();
    let minutes = dateObj.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    minutes = String(minutes).padStart(2, '0');
    return `${hours}:${minutes} ${ampm}`;
}

// Audio Feedback System (Synthesized via Web Audio API)
function playSound(type) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (type === 'success') {
            // High-pitched double chime
            const osc1 = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
            osc1.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc1.start();
            osc1.stop(audioCtx.currentTime + 0.35);
        } else if (type === 'error') {
            // Low buzz
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.45);
        }
    } catch (e) {
        console.warn("Audio synthesis not supported or blocked by browser policy:", e);
    }
}

// Toast Notifications
function showToast(message, type = 'info') {
    const toastBox = document.getElementById("toast-box");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;
    
    toastBox.appendChild(toast);
    lucide.createIcons({ attrs: { class: 'toast-icon-svg' } });
    
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) reverse";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Tab Navigation
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));

    // Show target tab
    const targetTab = document.getElementById(`tab-${tabId}`);
    const targetBtn = document.getElementById(`btn-${tabId}`);
    
    if (targetTab && targetBtn) {
        targetTab.classList.add("active");
        targetBtn.classList.add("active");
    }

    // Refresh views on active tab
    refreshAllViews();
}

// Refresh All Views & Tables
function refreshAllViews() {
    renderDirectoryTable();
    renderBulkGeneratorGrid();
    renderLogsTable();
    renderRecentLogsFeed();
    updateStatsOverview();
    lucide.createIcons();
}

// ----------------------------------------------------
// SECTION 2 LOGIC: EXCEL/CSV IMPORT & DRAG DROP
// ----------------------------------------------------
function setupDragAndDrop() {
    const dropzone = document.getElementById("excel-dropzone");
    const fileInput = document.getElementById("excel-file-input");

    dropzone.addEventListener("click", () => fileInput.click());

    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        if (e.dataTransfer.files.length) {
            handleExcelFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length) {
            handleExcelFile(e.target.files[0]);
        }
    });
}

// SheetJS Excel Parser
function handleExcelFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawJson = XLSX.utils.sheet_to_json(worksheet);

            if (rawJson.length === 0) {
                showToast("The Excel sheet is empty!", "error");
                return;
            }

            let importCount = 0;
            let skipCount = 0;

            rawJson.forEach(row => {
                // Find column keys in a case-insensitive, flexible manner
                const getVal = (aliases, contains = []) => {
                    for (let key in row) {
                        const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (aliases.includes(cleanKey) || contains.some(token => cleanKey.includes(token))) {
                            return row[key];
                        }
                    }
                    return '';
                };

                const cleanText = (value) => String(value || "").trim();

                const internId = cleanText(getVal(['internid', 'id', 'rollno', 'roll', 'studentid', 'idnumber', 'rollnumber', 'registrationno', 'regno', 'applicationno'], ['roll', 'studentid']));
                const name = cleanText(getVal(['name', 'fullname', 'studentname', 'internname', 'applicantname'], ['fullname']));
                const fatherName = cleanText(getVal(['fathername', 'fathersname', 'father', 'dadname', 'parentname', 'guardianname'], ['father']));
                const dob = normalizeDate(getVal(['dob', 'dateofbirth', 'birthdate', 'birth']));
                const department = cleanText(getVal(['department', 'dept', 'branch', 'course'])) || "SEnSRS Centre";
                const issueDate = normalizeDate(getVal(['issuedate', 'dateofissue', 'issue', 'start', 'startdate', 'joiningdate', 'internshipstartdate'])) || getLocalDateString();
                const validUpto = normalizeDate(getVal(['validupto', 'validuntil', 'end', 'enddate', 'completiondate', 'internshipenddate'])) || getLocalDateString();
                const phone = cleanText(getVal(['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact', 'contactno', 'contactnumber', 'whatsappnumber'], ['mobile']));
                const address = cleanText(getVal(['address', 'addr', 'location', 'residence', 'currentaddress', 'permanentaddress'], ['address'])) || "C-114, SAB, IIT ROPAR, Rupnagar, Punjab - 140001";
                const bloodGroup = cleanText(getVal(['bloodgroup', 'blood', 'bg'])).toUpperCase() || "O+";
                const email = cleanText(getVal(['email', 'emailaddress', 'mail'], ['email']));
                const emergencyContact = cleanText(getVal(['emergencycontact', 'emergency', 'emergencyno', 'emergencycontactno', 'emergencycontactnumber'], ['emergency'])) || phone;
                const mentor = cleanText(getVal(['mentor', 'guide', 'advisor', 'supervisor'])) || "CoE SEnSRS Office";
                const photo = normalizePhotoSource(getVal(
                    ['photo', 'image', 'photourl', 'pic', 'picture', 'photodata', 'profilephoto', 'passportphoto', 'photograph', 'uploadphoto', 'uploadyourphoto', 'uploadpassportphoto', 'passportsizephoto', 'uploadpassportsizephoto'],
                    ['photo', 'image', 'picture', 'photograph']
                ));

                if (!internId || !name) {
                    skipCount++;
                    return; // Roll Number & Name are required
                }

                // Check if intern already exists in database
                const exists = interns.some(i => i.internId === internId);
                if (exists) {
                    skipCount++;
                    return;
                }

                interns.push({
                    internId,
                    name,
                    fatherName,
                    dob,
                    department,
                    issueDate,
                    validUpto,
                    phone,
                    address,
                    bloodGroup,
                    email,
                    emergencyContact,
                    mentor,
                    photo: photo || ""
                });
                importCount++;
            });

            if (importCount > 0) {
                localStorage.setItem("iitr_interns", JSON.stringify(interns));
                showToast(`Successfully imported ${importCount} interns!`, "success");
                if (skipCount > 0) {
                    showToast(`Skipped ${skipCount} duplicate or incomplete rows.`, "info");
                }
                switchTab('directory');
            } else {
                showToast("No new valid intern details were imported.", "error");
            }

        } catch (error) {
            console.error(error);
            showToast("Failed to parse the file. Ensure it is a valid Excel or CSV file.", "error");
        }
    };
    reader.readAsBinaryString(file);
}

// Download Excel Mock Template
function downloadTemplate() {
    const headers = [
        ["InternID", "Name", "FatherName", "DoB", "Department", "IssueDate", "ValidUpto", "ContactNo", "Address", "BloodGroup", "Email", "EmergencyContact", "Mentor", "Photo"],
        ["IITR-INT-2201", "Aman Verma", "Sh. Rajesh Verma", "15-04-2002", "Computer Science & Eng.", "01-05-2026", "31-07-2026", "9876543210", "C-114, SAB, IIT ROPAR, Rupnagar, Punjab - 140001", "B+", "aman@iitrpr.ac.in", "9876543211", "Dr. Sudarshan Iyengar", ""],
        ["IITR-INT-2202", "Neha Roy", "Sh. Amit Roy", "22-08-2003", "Electrical Engineering", "15-05-2026", "15-07-2026", "9988776655", "SEnSRS Office, SAB, IIT Ropar, Rupnagar - 140001", "O-", "neha@iitrpr.ac.in", "9988776650", "Dr. Subodh Kumar", ""]
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.map(e => e.map(val => `"${val}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "iit_ropar_intern_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Template CSV downloaded successfully.", "success");
}

// Manual registration handling
function handleManualRegistration(e) {
    e.preventDefault();

    const internId = document.getElementById("m-id").value.trim();
    const name = document.getElementById("m-name").value.trim();
    const fatherName = document.getElementById("m-father").value.trim();
    const dob = document.getElementById("m-dob").value;
    const department = document.getElementById("m-dept").value;
    const issueDate = document.getElementById("m-issue").value;
    const validUpto = document.getElementById("m-valid").value;
    const phone = document.getElementById("m-phone").value.trim();
    const address = document.getElementById("m-address").value.trim();
    const bloodGroup = document.getElementById("m-blood").value;
    const email = document.getElementById("m-email").value.trim();
    const emergencyContact = document.getElementById("m-emergency").value.trim();
    const mentor = document.getElementById("m-mentor").value.trim();

    // Validate ID uniqueness
    if (interns.some(i => i.internId === internId)) {
        showToast("An intern with this ID/Roll Number already exists!", "error");
        return;
    }

    const newIntern = {
        internId,
        name,
        fatherName,
        dob: normalizeDate(dob),
        department,
        issueDate: normalizeDate(issueDate),
        validUpto: normalizeDate(validUpto),
        phone,
        address,
        bloodGroup,
        email,
        emergencyContact,
        mentor,
        photo: ""
    };

    interns.push(newIntern);
    localStorage.setItem("iitr_interns", JSON.stringify(interns));
    showToast(`${name} registered successfully!`, "success");
    document.getElementById("manual-intern-form").reset();
    
    switchTab('directory');
}

// ----------------------------------------------------
// SECTION 3 LOGIC: INTERN DIRECTORY
// ----------------------------------------------------
function renderDirectoryTable(filterQuery = "") {
    const tableBody = document.getElementById("directory-table-body");
    tableBody.innerHTML = "";

    const query = filterQuery.toLowerCase().trim();
    const filtered = interns.filter(i => 
        (i.name || "").toLowerCase().includes(query) ||
        (i.internId || "").toLowerCase().includes(query) ||
        (i.department || "").toLowerCase().includes(query) ||
        (i.mentor || "").toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-gray); padding: 2rem;">
                    No matching records found.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(i => {
        const row = document.createElement("tr");

        // Photo Preview Cell
        const photoCell = i.photo 
            ? `<div class="photo-cell"><img src="${i.photo}" class="table-photo-preview"></div>`
            : `<div class="photo-cell"><div class="table-photo-missing" onclick="openPhotoModal('${i.internId}')"><i data-lucide="camera"></i></div></div>`;

        row.innerHTML = `
            <td>${photoCell}</td>
            <td style="font-weight: 700; color: var(--accent-gold);">${i.internId}</td>
            <td style="font-weight: 600;">${i.name}</td>
            <td>${i.department}</td>
            <td>${i.mentor || EMPTY_VALUE}</td>
            <td style="font-size: 0.8rem;">
                <div><span style="color:var(--success);">Issue:</span> ${formatDate(i.issueDate)}</div>
                <div><span style="color:var(--danger);">Upto:</span> ${formatDate(i.validUpto)}</div>
            </td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="openPhotoModal('${i.internId}')">
                        <i data-lucide="image"></i> Photo
                    </button>
                    <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="jumpToGenerator('${i.internId}')">
                        <i data-lucide="badge-check"></i> Card
                    </button>
                    <button class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background:rgba(231, 76, 60, 0.2); border:1px solid var(--danger);" onclick="deleteIntern('${i.internId}')">
                        <i data-lucide="trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
    lucide.createIcons();
}

function filterDirectory() {
    const val = document.getElementById("directory-search").value;
    renderDirectoryTable(val);
}

function deleteIntern(internId) {
    if (confirm(`Are you sure you want to delete intern with ID ${internId}? All registration and card data will be lost.`)) {
        interns = interns.filter(i => i.internId !== internId);
        localStorage.setItem("iitr_interns", JSON.stringify(interns));
        showToast("Intern deleted from system.", "info");
        refreshAllViews();
    }
}

function clearDatabase() {
    if (confirm("WARNING: This will delete ALL intern records and logs from the browser's storage. Do you wish to proceed?")) {
        interns = [];
        attendanceLogs = [];
        localStorage.removeItem("iitr_interns");
        localStorage.removeItem("iitr_attendance_logs");
        showToast("All data cleared successfully.", "info");
        refreshAllViews();
    }
}

function jumpToGenerator(internId) {
    switchTab('generator');
    // Scroll to the card
    setTimeout(() => {
        const cardElem = document.getElementById(`card-box-${internId}`);
        if (cardElem) {
            cardElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardElem.style.border = "2px dashed var(--accent-gold)";
            setTimeout(() => cardElem.style.border = "1px dashed rgba(255, 255, 255, 0.08)", 2000);
        }
    }, 200);
}

// ----------------------------------------------------
// PHOTO CAPTURE & WEBCAM LOGIC
// ----------------------------------------------------
function setupPhotoInputs() {
    // Hidden inputs are linked to triggers programmatically
}

function openPhotoModal(internId) {
    activePhotoInternId = internId;
    const intern = interns.find(i => i.internId === internId);
    
    document.getElementById("photo-modal-title").textContent = `Setup Photo - ${intern.name}`;
    
    // Clear preview structures
    document.getElementById("captured-preview-container").style.display = "none";
    document.getElementById("captured-preview-img").src = "";
    document.getElementById("photo-file-input").value = "";
    document.getElementById("btn-take-snapshot").disabled = true;

    document.getElementById("photo-modal").classList.add("active");
}

function closePhotoModal() {
    stopWebcam();
    document.getElementById("photo-modal").classList.remove("active");
    activePhotoInternId = null;
}

function startWebcam() {
    const video = document.getElementById("webcam-preview");
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
            video: {
                width: 320,
                height: 400,
                facingMode: 'user'
            }
        })
        .then(stream => {
            activeWebcamStream = stream;
            video.srcObject = stream;
            video.play();
            document.getElementById("btn-take-snapshot").disabled = false;
            showToast("Webcam connected successfully.", "success");
        })
        .catch(err => {
            console.error("Camera error:", err);
            showToast("Could not access webcam. Try uploading a file instead.", "error");
        });
    } else {
        showToast("Webcam capture is not supported by your browser.", "error");
    }
}

function stopWebcam() {
    if (activeWebcamStream) {
        activeWebcamStream.getTracks().forEach(track => track.stop());
        activeWebcamStream = null;
    }
    const video = document.getElementById("webcam-preview");
    video.srcObject = null;
    document.getElementById("btn-take-snapshot").disabled = true;
}

function captureWebcamSnapshot() {
    const video = document.getElementById("webcam-preview");
    const canvas = document.getElementById("webcam-capture-canvas");
    const context = canvas.getContext("2d");

    // Draw the current video frame on canvas (rotated/scaled appropriately)
    context.drawImage(video, 0, 0, 320, 400);

    // Grab Base64 Data
    const dataURL = canvas.toDataURL("image/jpeg");
    
    // Render preview image
    const previewContainer = document.getElementById("captured-preview-container");
    const previewImg = document.getElementById("captured-preview-img");
    previewImg.src = dataURL;
    previewContainer.style.display = "flex";

    // Shut down video stream to save resources
    stopWebcam();
}

function handlePhotoFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast("Please upload a valid image file.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const dataURL = event.target.result;
        
        // Show in Preview Area
        const previewContainer = document.getElementById("captured-preview-container");
        const previewImg = document.getElementById("captured-preview-img");
        previewImg.src = dataURL;
        previewContainer.style.display = "flex";
        
        stopWebcam(); // Shut down camera stream if active
    };
    reader.readAsDataURL(file);
}

function confirmProfilePhoto() {
    const previewImg = document.getElementById("captured-preview-img");
    const photoBase64 = previewImg.src;

    if (!photoBase64 || photoBase64 === window.location.href) {
        showToast("No valid photo selected.", "error");
        return;
    }

    const index = interns.findIndex(i => i.internId === activePhotoInternId);
    if (index !== -1) {
        interns[index].photo = photoBase64;
        localStorage.setItem("iitr_interns", JSON.stringify(interns));
        showToast("Profile photo linked successfully!", "success");
        closePhotoModal();
        refreshAllViews();
    }
}

// ----------------------------------------------------
// SECTION 4 LOGIC: ID CARD GENERATOR (BULK & SINGLE)
// ----------------------------------------------------
function displayValue(value) {
    return value ? String(value).trim() : EMPTY_VALUE;
}

function createTemplateFrontCard(i, options = {}) {
    const cardId = options.cardId || `card-${i.internId}`;
    const interactive = options.interactive !== false;
    const photoClick = interactive ? ` onclick="openPhotoModal('${i.internId}')"` : "";
    const photoEl = i.photo
        ? `<img src="${i.photo}" class="template-photo-img" alt="${displayValue(i.name)}">`
        : `<div class="template-photo-missing"${photoClick}><i data-lucide="camera"></i><span>Add Photo</span></div>`;

    return `
        <div class="id-card-container card-front template-card-front" id="${cardId}">
            <div class="template-photo-zone">
                ${photoEl}
            </div>
            <span class="template-field template-field-id">${displayValue(i.internId)}</span>
            <span class="template-field template-field-name">${displayValue(i.name)}</span>
            <span class="template-field template-field-father">${displayValue(i.fatherName)}</span>
            <span class="template-field template-field-dob">${formatDate(i.dob)}</span>
            <span class="template-field template-field-dept">${displayValue(i.department)}</span>
            <span class="template-field template-field-issue">${formatDate(i.issueDate)}</span>
            <span class="template-field template-field-valid">${formatDate(i.validUpto)}</span>
            <span class="template-field template-field-phone">${displayValue(i.phone)}</span>
            <span class="template-field template-field-address">${displayValue(i.address)}</span>
        </div>
    `;
}

function renderBulkGeneratorGrid() {
    const grid = document.getElementById("bulk-card-render-grid");
    grid.innerHTML = "";

    if (interns.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-gray); padding: 3rem;">
                No intern records available to generate cards.
            </div>
        `;
        return;
    }

    interns.forEach(i => {
        // Initialize card side state if not present
        if (!cardRotations[i.internId]) {
            cardRotations[i.internId] = 'front';
        }

        const isFront = cardRotations[i.internId] === 'front';

        // Create Container Card Box
        const cardBox = document.createElement("div");
        cardBox.className = "bulk-card-box";
        cardBox.id = `card-box-${i.internId}`;

        // 1. Generate Card HTML depending on rotation state
        let cardInnerContent = "";
        
        if (isFront) {
            cardInnerContent = createTemplateFrontCard(i);
        } else if (false) {
            // CARD FRONT HTML
            const photoSrc = i.photo ? i.photo : "";
            const photoEl = photoSrc 
                ? `<img src="${photoSrc}" class="card-photo">`
                : `
                    <div class="card-photo-placeholder" onclick="openPhotoModal('${i.internId}')">
                        <i data-lucide="user-x"></i>
                        <span>Click to<br>add Photo</span>
                    </div>
                `;

            cardInnerContent = `
                <div class="id-card-container card-front" id="card-${i.internId}">
                    <!-- Watermark SVG -->
                    <svg class="card-watermark" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="100" cy="100" r="95" stroke="#005432" stroke-width="2" stroke-dasharray="4 4" opacity="0.4" />
                        <circle cx="100" cy="100" r="90" stroke="#005432" stroke-width="1" opacity="0.4" />
                        <circle cx="100" cy="100" r="70" stroke="#005432" stroke-width="1.5" opacity="0.4" />
                        <path d="M90 120 L90 60 L80 75 L90 75 L75 95 L90 95 L70 115 L110 115 Z" fill="#005432" opacity="0.25"/>
                        <path d="M110 120 L110 50 L100 65 L110 65 L95 85 L110 85 L90 105 L130 105 Z" fill="#005432" opacity="0.3"/>
                        <path d="M60 125 Q80 120 100 125 T140 125" stroke="#005432" stroke-width="2" fill="none" opacity="0.4"/>
                        <path d="M65 130 Q80 127 100 130 T135 130" stroke="#005432" stroke-width="2" fill="none" opacity="0.4"/>
                        <text x="50%" y="30" font-family="Arial" font-size="9" font-weight="bold" fill="#005432" opacity="0.3" text-anchor="middle">CENTRE OF EXCELLENCE</text>
                        <text x="50%" y="170" font-family="Arial" font-size="9" font-weight="bold" fill="#005432" opacity="0.3" text-anchor="middle">SEnSRS - IIT Ropar</text>
                    </svg>

                    <!-- Header Row -->
                    <div class="card-header-row">
                        <img src="iitrpr_logo.png" class="card-logo-left" alt="IIT Ropar Logo">
                        <div class="card-header-green-box">
                            <div class="card-header-title-1">CENTRE OF EXCELLENCE</div>
                            <div class="card-header-title-2">Socio-Environmental Sustainability in River Sand Mining - SEnSRS</div>
                            <div class="card-header-title-3">INDIAN INSTITUTE OF TECHNOLOGY ROPAR</div>
                            <div class="card-header-title-4">An Autonomous Institute under MoE, Govt. of India</div>
                            <div class="card-header-title-5">C-114, SAB, IIT ROPAR, Rupnagar, Punjab - 140001</div>
                        </div>
                        <img src="punjab_sarkar.png" class="card-logo-right" alt="Govt of Punjab Emblem">
                    </div>
                    
                    <!-- Card Body -->
                    <div class="card-body">
                        <!-- Left Column (Photo & Signature) -->
                        <div class="card-left-column">
                            <div class="card-photo-container">
                                ${photoEl}
                            </div>
                            <div class="card-holder-signature-text">Holder's Signature</div>
                        </div>
                        
                        <!-- Middle Column (Details) -->
                        <div class="card-middle-column">
                            <div class="card-details">
                                <div class="card-detail-row">
                                    <span class="card-detail-label">ID Number</span>
                                    <span class="card-detail-colon">:</span>
                                    <span class="card-detail-val">${i.internId}</span>
                                </div>
                                <div class="card-detail-row">
                                    <span class="card-detail-label">Name</span>
                                    <span class="card-detail-colon">:</span>
                                    <span class="card-detail-val">${i.name}</span>
                                </div>
                                <div class="card-detail-row">
                                    <span class="card-detail-label">Father's Name</span>
                                    <span class="card-detail-colon">:</span>
                                    <span class="card-detail-val">${i.fatherName}</span>
                                </div>
                                <div class="card-detail-row">
                                    <span class="card-detail-label">DoB</span>
                                    <span class="card-detail-colon">:</span>
                                    <span class="card-detail-val">${formatDate(i.dob)}</span>
                                </div>
                                <div class="card-detail-row">
                                    <span class="card-detail-label">Department</span>
                                    <span class="card-detail-colon">:</span>
                                    <span class="card-detail-val">${i.department}</span>
                                </div>
                                <div class="card-detail-row">
                                    <span class="card-detail-label">Date of Issue</span>
                                    <span class="card-detail-colon">:</span>
                                    <span class="card-detail-val">${formatDate(i.issueDate)}</span>
                                </div>
                                <div class="card-detail-row">
                                    <span class="card-detail-label">Valid upto</span>
                                    <span class="card-detail-colon">:</span>
                                    <span class="card-detail-val">${formatDate(i.validUpto)}</span>
                                </div>
                                <div class="card-detail-row">
                                    <span class="card-detail-label">Contact No.</span>
                                    <span class="card-detail-colon">:</span>
                                    <span class="card-detail-val">${i.phone}</span>
                                </div>
                                <div class="card-detail-row">
                                    <span class="card-detail-label">Address</span>
                                    <span class="card-detail-colon">:</span>
                                    <span class="card-detail-val" style="font-size: 0.55rem; line-height: 1.1;">${i.address}</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Right Column (Vertical Badge & QR) -->
                        <div class="card-right-column">
                            <div class="intern-vertical-badge">INTERN</div>
                            <div class="card-qr-container">
                                <canvas id="qr-${i.internId}"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Footer Section -->
                    <div class="card-footer-info-row">
                        Issued by: Centre of Excellence - SEnSRS, IIT Ropar
                    </div>
                    <div class="card-footer-dark-bar">
                        <div class="card-footer-decorations">
                            <div class="decor-bar"></div>
                            <div class="decor-dashed"></div>
                            <div class="decor-dots">
                                <div class="decor-dot"></div>
                                <div class="decor-dot"></div>
                                <div class="decor-dot"></div>
                            </div>
                        </div>
                        <div class="card-footer-contacts">
                            <span>WWW.SENSRS.COM</span>
                            <span>01881 232632</span>
                            <span>coe@sensrs.com</span>
                        </div>
                    </div>
                    <div class="card-footer-property-disclaimer">
                        This ID card is the property of IIT Ropar and is non-transferable. It must be returned to the issuing authority upon completion or termination of the internship.
                    </div>
                </div>
            `;
        } else {
            // CARD BACK HTML
            cardInnerContent = `
                <div class="id-card-container card-back" id="card-${i.internId}">
                    <!-- Header -->
                    <div class="card-back-header">
                        <h3>INDIAN INSTITUTE OF TECHNOLOGY ROPAR</h3>
                        <p style="font-size:0.5rem; color:var(--accent-gold); letter-spacing: 0.5px; font-weight:600; text-transform:uppercase;">Nangal Road, Rupnagar, Punjab - 140001</p>
                    </div>
                    
                    <!-- Body -->
                    <div class="card-back-body">
                        <!-- Left Column -->
                        <div class="card-back-left">
                            <!-- Details list -->
                            <div class="card-back-details">
                                <div class="card-detail-row" style="margin-bottom: 3px;">
                                    <span class="card-detail-label" style="width:90px;">Blood Group:</span>
                                    <span class="card-detail-val" style="font-weight:700; color:var(--danger);">${i.bloodGroup || EMPTY_VALUE}</span>
                                </div>
                                <div class="card-detail-row" style="margin-bottom: 3px;">
                                    <span class="card-detail-label" style="width:90px;">Mobile:</span>
                                    <span class="card-detail-val">${i.phone}</span>
                                </div>
                                <div class="card-detail-row" style="margin-bottom: 3px;">
                                    <span class="card-detail-label" style="width:90px;">Email:</span>
                                    <span class="card-detail-val">${i.email || EMPTY_VALUE}</span>
                                </div>
                                <div class="card-detail-row" style="margin-bottom: 3px;">
                                    <span class="card-detail-label" style="width:90px;">Valid From:</span>
                                    <span class="card-detail-val">${formatDate(i.issueDate)}</span>
                                </div>
                                <div class="card-detail-row" style="margin-bottom: 3px;">
                                    <span class="card-detail-label" style="width:90px;">Valid Till:</span>
                                    <span class="card-detail-val">${formatDate(i.validUpto)}</span>
                                </div>
                                <div class="card-detail-row">
                                    <span class="card-detail-label" style="width:90px;">Emergency No:</span>
                                    <span class="card-detail-val">${i.emergencyContact || EMPTY_VALUE}</span>
                                </div>
                            </div>

                            <!-- Instructions -->
                            <div class="card-instructions">
                                <h4>Important instructions</h4>
                                <ul>
                                    <li>Always wear this card while on institute campus.</li>
                                    <li>Loss of card must be reported to the mentor immediately.</li>
                                    <li>This card is non-transferable and must be surrendered on completion.</li>
                                </ul>
                            </div>
                        </div>
                        
                        <!-- Right Column -->
                        <div class="card-back-right">
                            <div class="barcode-strip">
                                <div class="stripes"></div>
                                <span style="font-size:0.45rem;">${i.internId}</span>
                            </div>
                            <div class="card-qr-container-back">
                                <canvas id="qr-${i.internId}"></canvas>
                            </div>
                            
                            <div class="card-signature-block">
                                <!-- Styled Vector SVG Signature -->
                                <svg class="card-signature-img" viewBox="0 0 100 40" width="80" height="25" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10,25 Q30,10 40,28 T60,20 T80,25 T95,15" fill="none" stroke="#1E3E62" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M15,20 L85,22" fill="none" stroke="#1E3E62" stroke-width="1" opacity="0.6"/>
                                </svg>
                                <div class="card-signature-line"></div>
                                <div class="card-signature-label">Dean, Academics</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        cardBox.innerHTML = `
            ${cardInnerContent}
            <div class="bulk-card-box-actions">
                <button class="btn btn-secondary" onclick="flipCard('${i.internId}')">
                    <i data-lucide="refresh-cw"></i> Flip Card
                </button>
                <button class="btn btn-primary" onclick="downloadCardImage('${i.internId}')">
                    <i data-lucide="download"></i> Download PNG
                </button>
            </div>
        `;

        grid.appendChild(cardBox);

        setTimeout(() => renderQrCode(`qr-${i.internId}`, i), 50);
    });

    lucide.createIcons();
}

function renderQrCode(canvasId, intern) {
    const qrCanvas = document.getElementById(canvasId);
    if (!qrCanvas || typeof QRious === "undefined") return;

    new QRious({
        element: qrCanvas,
        value: intern.internId,
        size: 150,
        level: 'M',
        foreground: '#0B192C'
    });
}

function flipCard(internId) {
    cardRotations[internId] = cardRotations[internId] === 'front' ? 'back' : 'front';
    renderBulkGeneratorGrid();
}

function toggleFrontBackBulk() {
    // Check if the majority are front, then flip all to back, otherwise front
    const firstId = interns[0]?.internId;
    if (!firstId) return;

    const targetSide = cardRotations[firstId] === 'front' ? 'back' : 'front';
    interns.forEach(i => {
        cardRotations[i.internId] = targetSide;
    });

    renderBulkGeneratorGrid();
    showToast(`Flipped all cards to ${targetSide.toUpperCase()}`, "info");
}

// Convert HTML element to PNG and download using html2canvas
function downloadCardImage(internId) {
    const cardEl = document.getElementById(`card-${internId}`);
    if (!cardEl) return;

    const intern = interns.find(i => i.internId === internId);
    
    showToast(`Generating image for ${intern.name}...`, "info");
    
    // Renders the element to a canvas
    html2canvas(cardEl, {
        scale: 3, // High resolution scale factor
        useCORS: true,
        backgroundColor: null
    }).then(canvas => {
        const link = document.createElement("a");
        link.download = `${intern.name.replace(/\s+/g, '_')}_ID_${cardRotations[internId]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        showToast(`Downloaded card for ${intern.name}!`, "success");
    }).catch(err => {
        console.error(err);
        showToast("Error generating ID card image file.", "error");
    });
}

// One click all ID cards download
async function downloadAllCards() {
    if (interns.length === 0) {
        showToast("No interns are available to export.", "error");
        return;
    }

    showToast(`Beginning bulk export of ${interns.length} cards. Please allow downloads...`, "info");
    
    // Render and download cards with a small delay so browser doesn't block them all
    for (let i = 0; i < interns.length; i++) {
        const intern = interns[i];
        await new Promise(resolve => setTimeout(resolve, 500));
        downloadCardImage(intern.internId);
    }
}

// Bulk card printing helper
function printAllCards() {
    const printSection = document.getElementById("print-section");
    printSection.innerHTML = "";

    if (interns.length === 0) {
        showToast("No intern cards to print.", "error");
        return;
    }

    // Clone all cards into the print section
    interns.forEach(i => {
        const templateWrapper = document.createElement("div");
        templateWrapper.innerHTML = createTemplateFrontCard(i, {
            cardId: `print-front-${i.internId}`,
            interactive: false
        });
        const templateFront = templateWrapper.firstElementChild;
        templateFront.style.margin = "10px";
        printSection.appendChild(templateFront);

        if (false) {
        // Front Card
        const frontClone = document.createElement("div");
        frontClone.className = "id-card-container card-front";
        frontClone.style.margin = "10px";
        
        const photoSrc = i.photo ? i.photo : "";
        const photoEl = photoSrc 
            ? `<img src="${photoSrc}" class="card-photo">`
            : `
                <div class="card-photo-placeholder">
                    <i data-lucide="user-x"></i>
                    <span>Photo Missing</span>
                </div>
            `;

        frontClone.innerHTML = `
            <!-- Watermark SVG -->
            <svg class="card-watermark" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="100" r="95" stroke="#005432" stroke-width="2" stroke-dasharray="4 4" opacity="0.4" />
                <circle cx="100" cy="100" r="90" stroke="#005432" stroke-width="1" opacity="0.4" />
                <circle cx="100" cy="100" r="70" stroke="#005432" stroke-width="1.5" opacity="0.4" />
                <path d="M90 120 L90 60 L80 75 L90 75 L75 95 L90 95 L70 115 L110 115 Z" fill="#005432" opacity="0.25"/>
                <path d="M110 120 L110 50 L100 65 L110 65 L95 85 L110 85 L90 105 L130 105 Z" fill="#005432" opacity="0.3"/>
                <path d="M60 125 Q80 120 100 125 T140 125" stroke="#005432" stroke-width="2" fill="none" opacity="0.4"/>
                <path d="M65 130 Q80 127 100 130 T135 130" stroke="#005432" stroke-width="2" fill="none" opacity="0.4"/>
                <text x="50%" y="30" font-family="Arial" font-size="9" font-weight="bold" fill="#005432" opacity="0.3" text-anchor="middle">CENTRE OF EXCELLENCE</text>
                <text x="50%" y="170" font-family="Arial" font-size="9" font-weight="bold" fill="#005432" opacity="0.3" text-anchor="middle">SEnSRS - IIT Ropar</text>
            </svg>

            <!-- Header Row -->
            <div class="card-header-row">
                <img src="iitrpr_logo.png" class="card-logo-left" alt="IIT Ropar Logo">
                <div class="card-header-green-box">
                    <div class="card-header-title-1">CENTRE OF EXCELLENCE</div>
                    <div class="card-header-title-2">Socio-Environmental Sustainability in River Sand Mining - SEnSRS</div>
                    <div class="card-header-title-3">INDIAN INSTITUTE OF TECHNOLOGY ROPAR</div>
                    <div class="card-header-title-4">An Autonomous Institute under MoE, Govt. of India</div>
                    <div class="card-header-title-5">C-114, SAB, IIT ROPAR, Rupnagar, Punjab - 140001</div>
                </div>
                <img src="punjab_sarkar.png" class="card-logo-right" alt="Govt of Punjab Emblem">
            </div>
            
            <div class="card-body">
                <!-- Left Column (Photo & Signature) -->
                <div class="card-left-column">
                    <div class="card-photo-container">${photoEl}</div>
                    <div class="card-holder-signature-text">Holder's Signature</div>
                </div>
                <!-- Middle Column (Details) -->
                <div class="card-middle-column">
                    <div class="card-details">
                        <div class="card-detail-row">
                            <span class="card-detail-label">ID Number</span>
                            <span class="card-detail-colon">:</span>
                            <span class="card-detail-val">${i.internId}</span>
                        </div>
                        <div class="card-detail-row">
                            <span class="card-detail-label">Name</span>
                            <span class="card-detail-colon">:</span>
                            <span class="card-detail-val">${i.name}</span>
                        </div>
                        <div class="card-detail-row">
                            <span class="card-detail-label">Father's Name</span>
                            <span class="card-detail-colon">:</span>
                            <span class="card-detail-val">${i.fatherName}</span>
                        </div>
                        <div class="card-detail-row">
                            <span class="card-detail-label">DoB</span>
                            <span class="card-detail-colon">:</span>
                            <span class="card-detail-val">${formatDate(i.dob)}</span>
                        </div>
                        <div class="card-detail-row">
                            <span class="card-detail-label">Department</span>
                            <span class="card-detail-colon">:</span>
                            <span class="card-detail-val">${i.department}</span>
                        </div>
                        <div class="card-detail-row">
                            <span class="card-detail-label">Date of Issue</span>
                            <span class="card-detail-colon">:</span>
                            <span class="card-detail-val">${formatDate(i.issueDate)}</span>
                        </div>
                        <div class="card-detail-row">
                            <span class="card-detail-label">Valid upto</span>
                            <span class="card-detail-colon">:</span>
                            <span class="card-detail-val">${formatDate(i.validUpto)}</span>
                        </div>
                        <div class="card-detail-row">
                            <span class="card-detail-label">Contact No.</span>
                            <span class="card-detail-colon">:</span>
                            <span class="card-detail-val">${i.phone}</span>
                        </div>
                        <div class="card-detail-row">
                            <span class="card-detail-label">Address</span>
                            <span class="card-detail-colon">:</span>
                            <span class="card-detail-val" style="font-size: 0.55rem; line-height: 1.1;">${i.address}</span>
                        </div>
                    </div>
                </div>
                <!-- Right Column (Vertical Badge & QR) -->
                <div class="card-right-column">
                    <div class="intern-vertical-badge">INTERN</div>
                    <div class="card-qr-container">
                        <canvas id="print-qr-${i.internId}"></canvas>
                    </div>
                </div>
            </div>
            
            <!-- Footer Section -->
            <div class="card-footer-info-row">
                Issued by: Centre of Excellence - SEnSRS, IIT Ropar
            </div>
            <div class="card-footer-dark-bar">
                <div class="card-footer-decorations">
                    <div class="decor-bar"></div>
                    <div class="decor-dashed"></div>
                    <div class="decor-dots">
                        <div class="decor-dot"></div>
                        <div class="decor-dot"></div>
                        <div class="decor-dot"></div>
                    </div>
                </div>
                <div class="card-footer-contacts">
                    <span>WWW.SENSRS.COM</span>
                    <span>01881 232632</span>
                    <span>coe@sensrs.com</span>
                </div>
            </div>
            <div class="card-footer-property-disclaimer">
                This ID card is the property of IIT Ropar and is non-transferable. It must be returned to the issuing authority upon completion or termination of the internship.
            </div>
        `;
        
        printSection.appendChild(frontClone);

        // Generate QR code for printer clone
        setTimeout(() => {
            const qrCanvas = document.getElementById(`print-qr-${i.internId}`);
            if (qrCanvas) {
                new QRious({
                    element: qrCanvas,
                    value: `IIT Ropar Verified Intern\nID: ${i.internId}\nName: ${i.name}\nDept: ${i.department}\nMentor: ${i.mentor}`,
                    size: 150,
                    level: 'M',
                    foreground: '#0B192C'
                });
            }
        }, 10);
        }

        // Back Card
        const backClone = document.createElement("div");
        backClone.className = "id-card-container card-back";
        backClone.style.margin = "10px";
        backClone.innerHTML = `
            <div class="card-back-header">
                <h3>INDIAN INSTITUTE OF TECHNOLOGY ROPAR</h3>
                <p style="font-size:0.5rem; color:var(--accent-gold); letter-spacing: 0.5px; font-weight:600; text-transform:uppercase;">Nangal Road, Rupnagar, Punjab - 140001</p>
            </div>
            
            <div class="card-back-body">
                <!-- Left Column -->
                <div class="card-back-left">
                    <!-- Details list -->
                    <div class="card-back-details">
                        <div class="card-detail-row" style="margin-bottom: 3px;">
                            <span class="card-detail-label" style="width:90px;">Blood Group:</span>
                            <span class="card-detail-val" style="font-weight:700; color:var(--danger);">${i.bloodGroup || EMPTY_VALUE}</span>
                        </div>
                        <div class="card-detail-row" style="margin-bottom: 3px;">
                            <span class="card-detail-label" style="width:90px;">Mobile:</span>
                            <span class="card-detail-val">${i.phone}</span>
                        </div>
                        <div class="card-detail-row" style="margin-bottom: 3px;">
                            <span class="card-detail-label" style="width:90px;">Email:</span>
                            <span class="card-detail-val">${i.email || EMPTY_VALUE}</span>
                        </div>
                        <div class="card-detail-row" style="margin-bottom: 3px;">
                            <span class="card-detail-label" style="width:90px;">Valid From:</span>
                            <span class="card-detail-val">${formatDate(i.issueDate)}</span>
                        </div>
                        <div class="card-detail-row" style="margin-bottom: 3px;">
                            <span class="card-detail-label" style="width:90px;">Valid Till:</span>
                            <span class="card-detail-val">${formatDate(i.validUpto)}</span>
                        </div>
                        <div class="card-detail-row">
                            <span class="card-detail-label" style="width:90px;">Emergency No:</span>
                            <span class="card-detail-val">${i.emergencyContact || EMPTY_VALUE}</span>
                        </div>
                    </div>

                    <!-- Instructions -->
                    <div class="card-instructions">
                        <h4>Important instructions</h4>
                        <ul>
                            <li>Always wear this card while on institute campus.</li>
                            <li>Loss of card must be reported to the mentor immediately.</li>
                            <li>This card is non-transferable and must be surrendered on completion.</li>
                        </ul>
                    </div>
                </div>
                
                <!-- Right Column -->
                <div class="card-back-right">
                    <div class="barcode-strip">
                        <div class="stripes"></div>
                        <span style="font-size:0.45rem;">${i.internId}</span>
                    </div>
                    <div class="card-qr-container-back">
                        <canvas id="print-back-qr-${i.internId}"></canvas>
                    </div>
                    <div class="card-signature-block">
                        <svg class="card-signature-img" viewBox="0 0 100 40" width="80" height="25" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10,25 Q30,10 40,28 T60,20 T80,25 T95,15" fill="none" stroke="#1E3E62" stroke-width="2" stroke-linecap="round"/>
                            <path d="M15,20 L85,22" fill="none" stroke="#1E3E62" stroke-width="1" opacity="0.6"/>
                        </svg>
                        <div class="card-signature-line"></div>
                        <div class="card-signature-label">Dean, Academics</div>
                    </div>
                </div>
            </div>
            <div class="card-footer"></div>
        `;
        printSection.appendChild(backClone);
        setTimeout(() => renderQrCode(`print-back-qr-${i.internId}`, i), 10);
    });

    // Fire print menu
    setTimeout(() => {
        window.print();
    }, 500);
}

// ----------------------------------------------------
// SECTION 1 LOGIC: STUDENT ATTENDANCE TERMINAL
// ----------------------------------------------------
function processTerminalAttendance(direction) {
    const input = document.getElementById("terminal-id-input");
    const internId = input.value.trim();

    if (!internId) {
        showTerminalStatus("Please enter an Intern ID or Roll Number.", "error");
        playSound('error');
        return;
    }

    // 1. Verify intern exists
    const intern = interns.find(i => i.internId === internId);
    if (!intern) {
        showTerminalStatus(`Invalid Roll Number or ID: "${internId}". Contact Admin.`, "error");
        playSound('error');
        return;
    }

    const todayDate = getLocalDateString();
    const timeNow = new Date();
    const timeNowStr = formatTime(timeNow);
    const timeStamp = timeNow.toISOString();

    // 2. Load and parse attendance logs
    let index = attendanceLogs.findIndex(log => log.date === todayDate && log.internId === internId);
    
    if (direction === 'in') {
        if (index !== -1 && attendanceLogs[index].checkIn) {
            // Already checked in today
            showTerminalStatus(`${intern.name} is ALREADY checked in for today at ${formatTime(new Date(attendanceLogs[index].checkIn))}.`, "info");
            playSound('error');
            input.value = "";
            return;
        }

        if (index === -1) {
            // New daily entry
            attendanceLogs.push({
                date: todayDate,
                internId: internId,
                checkIn: timeStamp,
                checkOut: null,
                status: "Present"
            });
        } else {
            // Update existing entry if checkout exists but checkin was empty
            attendanceLogs[index].checkIn = timeStamp;
            attendanceLogs[index].status = "Present";
        }
        
        showTerminalStatus(`Welcome ${intern.name}! Checked In successfully at ${timeNowStr}.`, "success");
        playSound('success');
    } else {
        // Out Direction
        if (index === -1) {
            // Checked out before checking in (Warning, but allowed, we set standard Checkin at 9:00 AM)
            const standardCheckin = new Date();
            standardCheckin.setHours(9, 0, 0, 0);
            
            attendanceLogs.push({
                date: todayDate,
                internId: internId,
                checkIn: standardCheckin.toISOString(),
                checkOut: timeStamp,
                status: "Checked Out"
            });
            showTerminalStatus(`${intern.name} Checked Out at ${timeNowStr}. (Note: No Check-In found, set to 09:00 AM)`, "success");
            playSound('success');
        } else {
            if (attendanceLogs[index].checkOut) {
                showTerminalStatus(`${intern.name} is ALREADY checked out for today at ${formatTime(new Date(attendanceLogs[index].checkOut))}.`, "info");
                playSound('error');
                input.value = "";
                return;
            }

            attendanceLogs[index].checkOut = timeStamp;
            attendanceLogs[index].status = "Checked Out";
            
            // Calculate working hours duration
            const inTime = new Date(attendanceLogs[index].checkIn);
            const outTime = new Date(timeStamp);
            const diffMs = outTime - inTime;
            const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(2);

            showTerminalStatus(`Goodbye ${intern.name}! Checked Out at ${timeNowStr}. Duration: ${diffHrs} Hrs.`, "success");
            playSound('success');
        }
    }

    // Save and Refresh Views
    localStorage.setItem("iitr_attendance_logs", JSON.stringify(attendanceLogs));
    input.value = "";
    refreshAllViews();
}

function showTerminalStatus(message, type) {
    const statusOverlay = document.getElementById("terminal-status");
    statusOverlay.textContent = message;
    statusOverlay.className = `terminal-status-overlay ${type}`;
    
    // Auto-focus terminal input after action
    document.getElementById("terminal-id-input").focus();

    // Auto-clear overlay message after 6 seconds
    setTimeout(() => {
        if (statusOverlay.textContent === message) {
            statusOverlay.className = "terminal-status-overlay";
            statusOverlay.style.display = "none";
        }
    }, 6000);
}

// ----------------------------------------------------
// SECTION 5 LOGIC: ADMIN ATTENDANCE LOGS
// ----------------------------------------------------
function updateStatsOverview() {
    document.getElementById("stats-total-interns").textContent = interns.length;
    
    const today = getLocalDateString();
    const todayLogs = attendanceLogs.filter(log => log.date === today);

    const checkedInCount = todayLogs.filter(log => log.checkIn).length;
    const checkedOutCount = todayLogs.filter(log => log.checkOut).length;

    document.getElementById("stats-checked-in").textContent = checkedInCount;
    document.getElementById("stats-checked-out").textContent = checkedOutCount;

    const rate = interns.length > 0 ? ((checkedInCount / interns.length) * 100).toFixed(0) : 0;
    document.getElementById("stats-attendance-rate").textContent = `${rate}%`;
}

function renderRecentLogsFeed() {
    const feed = document.getElementById("recent-logs-feed");
    feed.innerHTML = "";

    const today = getLocalDateString();
    const todayLogs = attendanceLogs.filter(log => log.date === today);

    if (todayLogs.length === 0) {
        feed.innerHTML = `
            <div class="recent-checkin-item" style="justify-content: center; color: var(--text-gray);">
                No attendance marked today.
            </div>
        `;
        return;
    }

    // Sort by latest timestamp (either checkin or checkout)
    const sorted = todayLogs.map(log => {
        const intern = interns.find(i => i.internId === log.internId) || { name: "Unknown" };
        const displayTime = log.checkOut ? new Date(log.checkOut) : new Date(log.checkIn);
        const actionType = log.checkOut ? 'out' : 'in';
        return {
            name: intern.name,
            internId: log.internId,
            time: formatTime(displayTime),
            rawTime: displayTime,
            type: actionType
        };
    }).sort((a,b) => b.rawTime - a.rawTime).slice(0, 5); // top 5

    sorted.forEach(item => {
        const el = document.createElement("div");
        el.className = "recent-checkin-item";
        el.innerHTML = `
            <div>
                <span class="recent-checkin-name">${item.name}</span>
                <span style="color:var(--text-gray); font-size:0.75rem;"> (${item.internId})</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.8rem;">
                <span class="recent-checkin-time">${item.time}</span>
                <span class="recent-checkin-badge ${item.type}">${item.type === 'in' ? 'Checked In' : 'Checked Out'}</span>
            </div>
        `;
        feed.appendChild(el);
    });
}

function renderLogsTable() {
    const tableBody = document.getElementById("logs-table-body");
    tableBody.innerHTML = "";

    const dateFilter = document.getElementById("log-date-filter").value;
    const searchQuery = document.getElementById("logs-search").value.toLowerCase().trim();

    // Filter logs
    let filteredLogs = attendanceLogs;
    
    if (dateFilter) {
        filteredLogs = filteredLogs.filter(log => log.date === dateFilter);
    }

    if (searchQuery) {
        filteredLogs = filteredLogs.filter(log => {
            const intern = interns.find(i => i.internId === log.internId);
            if (!intern) return false;
            return intern.name.toLowerCase().includes(searchQuery) || log.internId.toLowerCase().includes(searchQuery);
        });
    }

    if (filteredLogs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-gray); padding: 2rem;">
                    No attendance logs found matching filters.
                </td>
            </tr>
        `;
        return;
    }

    // Sort newest logs first
    filteredLogs.sort((a,b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return new Date(b.checkIn || b.checkOut) - new Date(a.checkIn || a.checkOut);
    });

    filteredLogs.forEach(log => {
        const intern = interns.find(i => i.internId === log.internId) || {
            name: "Unknown Intern",
            department: "Unknown"
        };

        const inTimeStr = log.checkIn ? formatTime(new Date(log.checkIn)) : EMPTY_VALUE;
        const outTimeStr = log.checkOut ? formatTime(new Date(log.checkOut)) : EMPTY_VALUE;
        
        let durationStr = EMPTY_VALUE;
        if (log.checkIn && log.checkOut) {
            const durationMs = new Date(log.checkOut) - new Date(log.checkIn);
            const hrs = Math.floor(durationMs / (1000 * 60 * 60));
            const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
            durationStr = `${hrs}h ${mins}m`;
        }

        let badgeClass = "badge-present";
        let statusLabel = "Checked In";
        if (log.status === 'Checked Out') {
            badgeClass = "badge-checkedout";
            statusLabel = "Completed";
        }

        const row = document.createElement("tr");
        row.innerHTML = `
            <td style="font-weight:600;">${log.date}</td>
            <td style="font-weight:700; color:var(--accent-gold);">${log.internId}</td>
            <td style="font-weight:600;">${intern.name}</td>
            <td>${intern.department}</td>
            <td style="color: var(--success); font-weight:500;">${inTimeStr}</td>
            <td style="color: var(--accent-orange); font-weight:500;">${outTimeStr}</td>
            <td>${durationStr}</td>
            <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

function filterAttendanceLogs() {
    renderLogsTable();
}

// Export logs database to CSV
function exportAttendanceLogsCSV() {
    if (attendanceLogs.length === 0) {
        showToast("No logs to export.", "error");
        return;
    }

    const headers = ["Date", "Intern ID", "Name", "Department", "Check-In Timestamp", "Check-Out Timestamp", "Hours Worked", "Status"];
    
    let csvRows = [];
    csvRows.push(headers.join(","));

    attendanceLogs.forEach(log => {
        const intern = interns.find(i => i.internId === log.internId) || { name: "Unknown", department: "Unknown" };
        
        let durationHrs = "0.00";
        if (log.checkIn && log.checkOut) {
            durationHrs = ((new Date(log.checkOut) - new Date(log.checkIn)) / (1000 * 60 * 60)).toFixed(2);
        }

        const row = [
            log.date,
            log.internId,
            `"${intern.name}"`,
            `"${intern.department}"`,
            log.checkIn || EMPTY_VALUE,
            log.checkOut || EMPTY_VALUE,
            durationHrs,
            log.status
        ];

        csvRows.push(row.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `iit_ropar_attendance_report_${getLocalDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV report exported successfully.", "success");
}

// Listening for barcode/QR code reader scans simulated by keypress buffer
let scanBuffer = "";
let lastKeyTime = Date.now();

document.addEventListener("keypress", (e) => {
    // Only listen for key events in main screen, check if scanner emits inputs
    const activeElement = document.activeElement;
    if (activeElement && activeElement.tagName === 'INPUT') return; // ignore if user typing in a textbox

    const now = Date.now();
    if (now - lastKeyTime > 200) {
        scanBuffer = ""; // Reset buffer if typing slow (human typing vs barcode speed)
    }
    lastKeyTime = now;

    if (e.key === 'Enter') {
        if (scanBuffer.length > 2) {
            // Check if matches an Intern ID
            const cleanCode = scanBuffer.replace(/[^a-zA-Z0-9\-]/g, '');
            const internExists = interns.some(i => i.internId === cleanCode);
            if (internExists) {
                // Focus terminal and submit
                switchTab('terminal');
                const termInput = document.getElementById("terminal-id-input");
                termInput.value = cleanCode;
                processTerminalAttendance('in'); // Default checkin on card scan
                showToast(`Barcode Scanned: ${cleanCode}`, "success");
            }
            scanBuffer = "";
        }
    } else {
        scanBuffer += e.key;
    }
});
