import os
from dotenv import load_dotenv

from nook import create_app

app = create_app()

if __name__ == "__main__":
    load_dotenv()
    debug_mode = os.getenv("DEBUG", "false") == "true"
    port = int(os.getenv("PORT", "5317"))
    app.run(host="0.0.0.0", port=port, debug=debug_mode)