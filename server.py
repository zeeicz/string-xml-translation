from flask import Flask, request, send_file, send_from_directory, Response
import tempfile
import os
import json
from translate_xml import translate_xml, setup_progress_callback
import threading
import queue

app = Flask(__name__, static_folder='public', static_url_path='')

# Global variables to track progress
translation_progress = {
    "current": 0,
    "total": 0,
    "messages": queue.Queue()
}

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

# Create a route for SSE (Server-Sent Events)
@app.route('/translation-progress')
def sse_progress():
    def generate():
        while True:
            try:
                # Try to get a message from the queue, with timeout
                message = translation_progress["messages"].get(timeout=0.5)
                yield f"data: {json.dumps(message)}\n\n"
            except queue.Empty:
                # Send a keep-alive comment to prevent the connection from timing out
                yield ": keep-alive\n\n"
    
    return Response(generate(), mimetype='text/event-stream')

def progress_callback(current, total, message=None):
    """Callback function to update progress and add log messages"""
    translation_progress["current"] = current
    translation_progress["total"] = total
    
    # Send progress update
    progress_data = {
        "type": "progress",
        "current": current,
        "total": total
    }
    translation_progress["messages"].put(progress_data)
    
    # If there's a log message, send it too
    if message:
        log_data = {
            "type": "log",
            "message": message
        }
        translation_progress["messages"].put(log_data)

@app.route('/translate', methods=['POST'])
def translate_file():
    uploaded_file = request.files.get('file')
    if not uploaded_file:
        return "No file uploaded", 400

    from_language = request.form.get('from', 'en')
    to_language = request.form.get('to', 'id')

    # Reset progress tracking
    global translation_progress
    translation_progress = {
        "current": 0,
        "total": 0,
        "messages": queue.Queue()
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, 'input.xml')
        output_path = os.path.join(tmpdir, 'output.xml')
        uploaded_file.save(input_path)

        # Set up the progress callback
        setup_progress_callback(progress_callback)
        
        # Perform translation
        translate_xml(input_path, output_path, src=from_language, target=to_language)

        # Send completion message
        completion_data = {
            "type": "complete",
            "total": translation_progress["total"]
        }
        translation_progress["messages"].put(completion_data)

        return send_file(output_path, as_attachment=True, download_name='strings_translated.xml')

if __name__ == '__main__':
    app.run(debug=True)