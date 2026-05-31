from flask import Flask, jsonify
import psycopg2
import os

app = Flask(__name__)

def get_db_connection():
    return psycopg2.connect(
        dbname=os.environ.get('PGDATABASE', 'your_db'),
        user=os.environ.get('PGUSER', 'your_user'),
        password=os.environ.get('PGPASSWORD', 'your_password'),
        host=os.environ.get('PGHOST', 'localhost'),
        port=os.environ.get('PGPORT', 5432)
    )

@app.route('/profiles')
def get_profiles():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM profiles1')
    rows = cur.fetchall()
    colnames = [desc[0] for desc in cur.description]
    data = [dict(zip(colnames, row)) for row in rows]
    cur.close()
    conn.close()
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True)
