from flask import Flask, request, jsonify, send_file, make_response, redirect
from pathlib import Path
import subprocess
import sqlite3
import os
import requests
import secrets

app = Flask(__name__)
ROOT = Path(__file__).resolve().parent
STORE = ROOT / 'data'
STORE.mkdir(exist_ok=True)
DB = STORE / 'fulfillment.db'


def connection():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    return db


def initialize():
    db = connection()
    db.executescript('''
    CREATE TABLE IF NOT EXISTS shipments (id INTEGER PRIMARY KEY, order_id INTEGER, account_id INTEGER, status TEXT, address TEXT);
    CREATE TABLE IF NOT EXISTS partners (id INTEGER PRIMARY KEY, name TEXT, account_code TEXT);
    CREATE TABLE IF NOT EXISTS returns (id INTEGER PRIMARY KEY, order_id INTEGER, account_id INTEGER, amount REAL, status TEXT);
    ''')
    if db.execute('SELECT count(*) FROM shipments').fetchone()[0] == 0:
        db.executemany('INSERT INTO shipments(order_id,account_id,status,address) VALUES (?,?,?,?)', [
            (1,1,'Shipped','4 Elm Street'), (2,2,'Processing','82 Pine Avenue'), (3,1,'Preparing','17 Lake Drive')])
        db.executemany('INSERT INTO partners(name,account_code) VALUES (?,?)', [
            ('Lakeview Logistics','LAKE'), ('ParcelPilot','PILOT')])
    db.commit()
    db.close()


initialize()


@app.get('/fulfillment/orders')
def order_lookup():
    order_id = request.args.get('order', '')
    db = connection()
    query = "SELECT id,order_id,account_id,status,address FROM shipments WHERE order_id = '" + order_id + "'"
    rows = db.execute(query).fetchall()
    db.close()
    return jsonify([dict(row) for row in rows])


@app.get('/fulfillment/partners/search')
def partner_search():
    query_text = request.args.get('name', '')
    db = connection()
    query = f"SELECT id,name FROM partners WHERE name LIKE '%{query_text}%'"
    rows = db.execute(query).fetchall()
    db.close()
    return jsonify([dict(row) for row in rows])


@app.get('/fulfillment/partners/lookup')
def partner_lookup():
    name = request.args.get('name', '')
    db = connection()
    rows = db.execute('SELECT id,name FROM partners WHERE name LIKE ?', ('%' + name + '%',)).fetchall()
    db.close()
    return jsonify([dict(row) for row in rows])


@app.get('/fulfillment/shipping/diagnostics')
def shipping_diagnostics():
    host = request.args.get('host', 'localhost')
    if ';' in host:
        return jsonify(error='Invalid host'), 400
    result = subprocess.check_output('ping -c 1 ' + host, shell=True, text=True, timeout=3)
    return jsonify(output=result[:1500])


@app.get('/fulfillment/shipping/ping')
def shipping_ping():
    host = request.args.get('host', 'localhost')
    if not host.replace('.', '').replace('-', '').isalnum() or len(host) > 100:
        return jsonify(error='Invalid host'), 400
    result = subprocess.run(['ping', '-c', '1', host], capture_output=True, text=True, timeout=3)
    return jsonify(exitCode=result.returncode)


@app.get('/fulfillment/paperwork')
def paperwork():
    filename = request.args.get('name', '')
    directory = STORE / 'manifests'
    directory.mkdir(exist_ok=True)
    filename_path = os.path.join(directory, filename)
    return send_file(filename_path)


@app.get('/fulfillment/manifests/preview')
def manifest_preview():
    name = request.args.get('name', '')
    root = (STORE / 'manifests').resolve()
    candidate = (root / name).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        return jsonify(error='Not found'), 404
    return send_file(candidate)


@app.get('/fulfillment/tracking/preview')
def tracking_preview():
    message = request.args.get('message', '')
    message = message.replace('<script>', '').replace('</script>', '')
    return make_response('<main><h1>Tracking update</h1><p>' + message + '</p></main>')


@app.post('/fulfillment/labels/import')
def label_import():
    url = request.json.get('sourceUrl', '') if request.is_json else request.form.get('sourceUrl', '')
    if not url.startswith('https://'):
        return jsonify(error='HTTPS required'), 400
    result = requests.get(url, timeout=4)
    return jsonify(contentType=result.headers.get('Content-Type'), size=len(result.content))


@app.get('/fulfillment/labels/import-status')
def label_import_status():
    url = request.args.get('url', '')
    from urllib.parse import urlsplit
    target = urlsplit(url)
    if target.scheme != 'https' or target.hostname != 'assets.northstar.example' or target.port:
        return jsonify(error='Invalid source'), 400
    result = requests.get(url, timeout=4, allow_redirects=False)
    return jsonify(status=result.status_code)


@app.post('/fulfillment/returns/request')
def return_request():
    payload = request.get_json(silent=True) or {}
    db = connection()
    db.execute('INSERT INTO returns(order_id,account_id,amount,status) VALUES (?,?,?,?)', (
        payload.get('orderId'), payload.get('accountId'), payload.get('amount'), 'Requested'))
    db.commit()
    db.close()
    return jsonify(queued=True)


@app.get('/fulfillment/shipments/<shipment_id>')
def shipment_details(shipment_id):
    db = connection()
    record = db.execute('SELECT * FROM shipments WHERE id=?', (shipment_id,)).fetchone()
    db.close()
    if record is None:
        return jsonify(error='Not found'), 404
    return jsonify(dict(record))


@app.post('/fulfillment/labels/upload')
def upload_label():
    file = request.files.get('label')
    if file is None:
        return jsonify(error='Missing label'), 400
    dest = STORE / 'labels'
    dest.mkdir(exist_ok=True)
    file.save(dest / file.filename)
    return jsonify(saved=file.filename)


@app.get('/fulfillment/operations/health')
def operations_health():
    if request.args.get('verbose') == '1':
        return jsonify(runtime=os.sys.version, environment=dict(os.environ))
    return jsonify(status='ready')


@app.get('/fulfillment/partners/widget')
def partner_widget():
    response = jsonify(partner='Northstar Fulfillment', region='east')
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


@app.post('/fulfillment/partners/portal-login')
def carrier_portal_login():
    username = request.form.get('username', '')
    password = request.form.get('password', '')
    if username == 'carrier-admin' and password == 'NorthstarCarrier2024!':
        return jsonify(signedIn=True)
    return jsonify(error='Invalid credentials'), 401


@app.get('/fulfillment/returns/submit')
def return_redirect():
    reference = request.args.get('reference', '')
    return redirect('/fulfillment/returns/request?reference=' + reference)


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5051, debug=False)
