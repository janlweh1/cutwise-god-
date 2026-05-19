import os
import environ
from supabase import create_client, Client

def seed_users():
    # Load env
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = environ.Env()
    environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

    url = env("SUPABASE_URL")
    service_key = env("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not service_key:
        print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env")
        return

    print(f"Connecting to Supabase at {url}...")
    supabase: Client = create_client(url, service_key)

    users_to_seed = [
        {
            "email": "employee@otto.com",
            "password": "password123",
            "role": "employee",
            "full_name": "John Employee"
        },
        {
            "email": "admin@otto.com",
            "password": "password123",
            "role": "admin",
            "full_name": "Otto Admin"
        },
        {
            "email": "supervisor@otto.com",
            "password": "password123",
            "role": "supervisor",
            "full_name": "Jane Supervisor"
        }
    ]

    for u in users_to_seed:
        try:
            # Check if user already exists
            # We can run a query or just attempt to create them.
            # In Supabase Admin API, we can use create_user.
            res = supabase.auth.admin.create_user({
                "email": u["email"],
                "password": u["password"],
                "email_confirm": True,
                "user_metadata": {
                    "role": u["role"],
                    "full_name": u["full_name"]
                }
            })
            print(f"Successfully created user: {u['email']} with role {u['role']}")
        except Exception as e:
            # Check if it fails because user already exists, or other issues
            print(f"Attempted to create user {u['email']}: {e}")

if __name__ == "__main__":
    seed_users()
