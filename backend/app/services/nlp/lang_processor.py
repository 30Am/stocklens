"""
Language detection and translation.
Detects Hindi/non-English articles and translates to English before NLP.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

_translator = None


def _get_translator():
    global _translator
    if _translator is None:
        try:
            from deep_translator import GoogleTranslator
            _translator = GoogleTranslator(source="auto", target="en")
        except Exception as e:
            log.warning("Translator init failed: %s", e)
    return _translator


def detect_and_translate(text: str) -> tuple[str, str]:
    """
    Returns (translated_text, detected_lang).
    If already English or detection fails, returns (original_text, 'en').
    """
    if not text or len(text.strip()) < 10:
        return text, "en"

    try:
        from langdetect import detect, LangDetectException
        lang = detect(text)
    except Exception:
        return text, "en"

    if lang == "en":
        return text, "en"

    try:
        translator = _get_translator()
        if translator:
            translated = translator.translate(text[:4000])  # API limit
            log.debug("translated %s→en (%d chars)", lang, len(text))
            return translated or text, lang
    except Exception as e:
        log.debug("translation failed: %s", e)

    return text, lang


def clean_text(text: str) -> str:
    """Strip HTML tags, excessive whitespace, and common ad phrases."""
    import re
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Remove URLs
    text = re.sub(r"https?://\S+", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    # Remove common noise phrases
    for noise in ["Click here", "Subscribe now", "Read more", "Advertisement"]:
        text = text.replace(noise, "")
    return text
