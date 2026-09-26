import os
from dotenv import load_dotenv

from nook import create_app

app = create_app()

if __name__ == "__main__":
    load_dotenv()
    port = int(os.getenv("PORT", "5317"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("DEBUG", False))
