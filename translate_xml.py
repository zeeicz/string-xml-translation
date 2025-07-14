import xml.etree.ElementTree as ET
from deep_translator import GoogleTranslator
import time

# Global progress callback
_progress_callback = None

def setup_progress_callback(callback):
    """Set the progress callback function"""
    global _progress_callback
    _progress_callback = callback

def translate_xml(input_path, output_path, src='en', target='id'):
    tree = ET.parse(input_path)
    root = tree.getroot()
    translator = GoogleTranslator(source=src, target=target)

    strings = root.findall('string')
    total_strings = len(strings)
    
    # Call the progress callback with the total number of strings
    if _progress_callback:
        _progress_callback(0, total_strings)
    
    for i, string in enumerate(strings):
        if string.text:
            try:
                translated = translator.translate(string.text)
                log_message = f"[{i+1}/{total_strings}] {string.text} => {translated}"
                
                # Update progress with log message
                if _progress_callback:
                    _progress_callback(i+1, total_strings, log_message)
                    
                print(log_message)
                string.text = translated
                
                # Add a small delay to avoid hitting API rate limits and to make progress visible
                time.sleep(0.1)
                
            except Exception as e:
                error_message = f"Failed to translate line {i+1}: {e}"
                if _progress_callback:
                    _progress_callback(i+1, total_strings, error_message)
                print(error_message)

    tree.write(output_path, encoding='utf-8', xml_declaration=True)
