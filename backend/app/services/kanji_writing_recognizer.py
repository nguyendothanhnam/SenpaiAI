"""Optional whole-character check; no training sample writes and no grading authority."""
import base64
import io
import logging
from .kanji_stroke_geometry import normalize


def recognizer_advice(strokes):
    if not strokes:
        return {'status':'empty','kanji':None}
    try:
        from PIL import Image, ImageDraw
        from ml.kanji_recognizer import predict_kanji
        image=Image.new('RGB',(256,256),'white');draw=ImageDraw.Draw(image)
        normalized=normalize(strokes)
        points=[[{'x':32+x*192,'y':32+y*192} for x,y in stroke] for stroke in normalized]
        for stroke in points:
            draw.line([(p['x'],p['y']) for p in stroke],fill='black',width=7,joint='curve')
        stream=io.BytesIO();image.save(stream,format='PNG')
        encoded='data:image/png;base64,'+base64.b64encode(stream.getvalue()).decode('ascii')
        predictions=predict_kanji(encoded,points,None,top_k=1)
        if not predictions:
            return {'status':'unavailable','kanji':None}
        top=predictions[0]
        return {'status':'ok','kanji':top['kanji'] if top.get('confidence',0)>=.6 else None,
                'confidence':top.get('confidence',0)}
    except Exception:
        logging.getLogger(__name__).warning('Optional writing recognizer check unavailable',exc_info=True)
        return {'status':'unavailable','kanji':None}
