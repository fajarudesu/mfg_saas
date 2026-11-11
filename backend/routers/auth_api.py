from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor
from database_pg import get_new_pg_db

# Jangan gunakan prefix di APIRouter jika ingin mendaftarkan /api/auth/login dan /api/users sekaligus
router = APIRouter(tags=["Authentication & Users"])

# Schema Pydantic
class LoginSchema(BaseModel):
    username: str
    password: str

class UserCreateSchema(BaseModel):
    nik: str
    name: str
    password: str
    role: str

class RoleUpdateSchema(BaseModel):
    role: str

# 1. API LOGIN (/api/auth/login)
@router.post("/api/auth/login")
def login(credentials: LoginSchema):
    conn = get_new_pg_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT nik, name, password, role FROM users WHERE TRIM(nik::text) = TRIM(%s)",
            (credentials.username.strip(),)
        )
        user = cursor.fetchone()
        cursor.close()

        if not user or str(user["password"]).strip() != str(credentials.password).strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="NIK atau password salah"
            )

        return {
            "status": "success",
            "message": "Login berhasil",
            "user": {
                "nik": user["nik"],
                "username": user["nik"],
                "name": user["name"],
                "role": user["role"]
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    finally:
        conn.close()

# 2. GET ALL USERS (/api/users) - UNTUK HALAMAN SETTINGS ROLE
@router.get("/api/users")
def get_users():
    conn = get_new_pg_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT nik, name, role FROM users ORDER BY nik ASC")
        users = cursor.fetchall()
        cursor.close()
        return {"status": "success", "data": users}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal mengambil data user: {str(e)}"
        )
    finally:
        conn.close()

# 3. CREATE USER (/api/users)
@router.post("/api/users")
def create_user(user_data: UserCreateSchema):
    conn = get_new_pg_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT nik FROM users WHERE TRIM(nik::text) = TRIM(%s)", (user_data.nik.strip(),))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="NIK Karyawan sudah terdaftar!"
            )
            
        cursor.execute("""
            INSERT INTO users (nik, name, password, role)
            VALUES (%s, %s, %s, %s)
            RETURNING nik, name, role
        """, (user_data.nik.strip(), user_data.name.strip(), user_data.password.strip(), user_data.role.strip()))
        
        new_user = cursor.fetchone()
        conn.commit()
        cursor.close()

        return {
            "status": "success",
            "message": "User berhasil ditambahkan",
            "data": new_user
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menyimpan user: {str(e)}"
        )
    finally:
        conn.close()

# 4. UPDATE ROLE USER (/api/users/{nik}/role)
@router.put("/api/users/{nik}/role")
def update_user_role(nik: str, payload: RoleUpdateSchema):
    conn = get_new_pg_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            UPDATE users SET role = %s WHERE TRIM(nik::text) = TRIM(%s)
            RETURNING nik, name, role
        """, (payload.role.strip(), nik.strip()))
        
        updated_user = cursor.fetchone()
        if not updated_user:
            raise HTTPException(status_code=404, detail="NIK tidak ditemukan")
            
        conn.commit()
        cursor.close()

        return {
            "status": "success",
            "message": f"Role NIK {nik} berhasil diubah ke {payload.role}",
            "data": updated_user
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal memperbarui role: {str(e)}"
        )
    finally:
        conn.close()

# 5. DELETE USER (/api/users/{nik})
@router.delete("/api/users/{nik}")
def delete_user(nik: str):
    conn = get_new_pg_db()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("DELETE FROM users WHERE TRIM(nik::text) = TRIM(%s) RETURNING nik", (nik.strip(),))
        deleted_user = cursor.fetchone()
        
        if not deleted_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User dengan NIK {nik} tidak ditemukan"
            )
            
        conn.commit()
        cursor.close()

        return {
            "status": "success",
            "message": f"User NIK {nik} berhasil dihapus"
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghapus user: {str(e)}"
        )
    finally:
        conn.close()