MAJORS = [
    "Computer Science",
    "Computational Media",
    "Computer Engineering",
    "Electrical Engineering",
    "Mechanical Engineering",
    "Aerospace Engineering",
    "Biomedical Engineering",
    "Industrial Engineering",
    "Civil Engineering",
    "Chemical Engineering",
    "Chemistry",
    "Physics",
    "Mathematics",
    "Biology",
    "Business",
    "Economics",
    "Architecture",
    "Industrial Design",
    "Public Policy",
    "Literature",
    "Psychology",
    "Environmental Engineering",
]

STEM_MAJORS = {
    "Computer Science",
    "Computational Media",
    "Computer Engineering",
    "Electrical Engineering",
    "Mechanical Engineering",
    "Aerospace Engineering",
    "Biomedical Engineering",
    "Industrial Engineering",
    "Civil Engineering",
    "Chemical Engineering",
    "Chemistry",
    "Physics",
    "Mathematics",
    "Biology",
    "Environmental Engineering",
}

DESIGN_MAJORS = {"Architecture", "Industrial Design", "Computational Media", "Literature"}

YEARS = [
    {"id": "1", "label": "First-year"},
    {"id": "2", "label": "Second-year"},
    {"id": "3", "label": "Third-year"},
    {"id": "4", "label": "Fourth-year"},
    {"id": "5+", "label": "Fifth-year+"},
    {"id": "grad", "label": "Graduate"},
]
YEAR_LABELS = {item["id"]: item["label"] for item in YEARS}

GENDERS = [
    {"id": "woman", "label": "Woman"},
    {"id": "man", "label": "Man"},
    {"id": "nonbinary", "label": "Nonbinary"},
    {"id": "undisclosed", "label": "Prefer not to say"},
]

SLEEP = [
    {"id": "early", "label": "Early", "hint": "Asleep before 11"},
    {"id": "typical", "label": "Typical", "hint": "11pm to 1am"},
    {"id": "late", "label": "Late", "hint": "After 1am"},
    {"id": "nocturnal", "label": "Nocturnal", "hint": "After 2am"},
]

CLEANLINESS = [
    {"id": "spotless", "label": "Spotless"},
    {"id": "tidy", "label": "Tidy"},
    {"id": "average", "label": "Average"},
    {"id": "relaxed", "label": "Relaxed"},
    {"id": "messy", "label": "Messy"},
]

STYLES = [
    {"id": "traditional", "label": "Traditional"},
    {"id": "suite", "label": "Suite"},
    {"id": "apartment", "label": "Apartment"},
]

INTERVIEW_QUESTIONS = [
    "What are you into — clubs, hobbies, and a Friday night that actually sounds like you?",
    "How clean do you keep a shared room, and how do you feel about noise and guests?",
    "When do you usually fall asleep and wake up, including weekends?",
    "What should someone crashing with you for a weekend know?",
]

AXIS_NAMES = [
    "outdoors",
    "music",
    "gaming",
    "design",
    "sports",
    "food",
    "nightlife",
    "quiet_nights",
    "early_riser",
    "night_owl",
    "spotless",
    "relaxed_clean",
    "stem",
    "humanities",
    "introvert",
    "extrovert",
    "cooking",
    "film",
    "reading",
    "fitness",
    "volunteering",
    "travel",
    "tech",
    "art",
    "conversation",
    "low_noise",
    "guests_ok",
    "study",
    "spontaneous",
    "atlanta",
    "planner",
    "performance",
]
