from typing import Dict, List, Any, Optional
import time
import json
import re
import asyncio
import ollama
import httpx
from ..core.config import settings
from .grammar_analyzer import grammar_generation_prompt
from .grammar_grounded import grounded_patterns
from .chat_prompt import CHAT_SYSTEM_PROMPT, build_chat_system_prompt, task_prompt
from .chat_quality import violations
from .chat_grounding import clean_chat_answer, finalize_chat_answer, reviewed_reference
from .chat_language import detect_chat_language, answer_needs_revision
from .chat_budget import CHAT_CALL, bounded_prompt, measured_generation, IncompleteChatResponse


GRAMMAR_SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'properties': {
        'sentence_meaning': {'type': 'string'},
        'vocabulary': {'type': 'array', 'maxItems': 12, 'items': {
            'type': 'object', 'additionalProperties': False,
            'properties': {'term': {'type': 'string'}, 'meaning': {'type': 'string'},
                           'jlpt_level': {'type': 'string', 'enum': ['N5', 'N4', 'N3', 'N2', 'N1']}},
            'required': ['term', 'meaning', 'jlpt_level']}},
        'grammar_patterns': {'type': 'array', 'maxItems': 6, 'items': {
            'type': 'object', 'additionalProperties': False,
            'properties': {key: {'type': 'string'} for key in ('pattern', 'evidence', 'explanation', 'example')},
            'required': ['pattern', 'evidence', 'explanation', 'example']}},
        'jlpt_level': {'type': 'string', 'enum': ['N5', 'N4', 'N3', 'N2', 'N1']},
        'difficulty_score': {'type': 'number', 'minimum': 1, 'maximum': 10},
        'suggestions': {'type': 'array', 'maxItems': 3, 'items': {'type': 'string'}},
    },
    'required': ['sentence_meaning', 'vocabulary', 'grammar_patterns', 'jlpt_level', 'difficulty_score', 'suggestions'],
}


class OllamaJapaneseLearningService:
    def __init__(self):
        # Store Ollama configuration
        self.model = settings.ollama_model
        self.base_url = settings.ollama_base_url
        self.embedding_model = "nomic-embed-text"

        # Initialize prompts
        self._setup_prompts()

    def _setup_prompts(self):
        """Setup all the prompt templates."""
        # Prompts are now built directly in methods
        pass

    def _call_ollama(
        self,
        prompt: str,
        system_prompt: str = None,
        max_retries: int = 1,
        temperature: Optional[float] = None,
        num_predict: int = 350,
        response_format: Any = None
    ) -> str:
        """Call Ollama API directly with fast execution options."""
        if CHAT_CALL.get():
            return measured_generation(self,prompt,system_prompt,num_predict,temperature)
        if not isinstance(response_format, dict) and not self.check_ollama_connection():
            raise Exception("Ollama is not running. Please start Ollama service.")

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})

                chat_options = {
                    "temperature": temperature if temperature is not None else 0.3,
                    "num_predict": num_predict,
                    "num_ctx": 2048,
                    "num_thread": 6,
                    "repeat_penalty": 1.12,
                }
                if isinstance(response_format, dict):
                    with httpx.Client(timeout=90) as client:
                        structured = client.post(f"{self.base_url.rstrip('/')}/api/chat", json={
                            'model': self.model, 'messages': messages, 'stream': False,
                            'format': response_format,
                            'options': chat_options,
                        })
                        structured.raise_for_status()
                        payload = structured.json()
                        if not payload.get('done') or payload.get('done_reason') == 'length':
                            raise ValueError('incomplete_grammar_response')
                        return payload['message']['content']
                response = ollama.chat(
                    model=self.model,
                    messages=messages,
                    options=chat_options,
                    **({'format': response_format} if response_format else {}),
                )
                return response['message']['content']
            except Exception as e:
                last_error = e
                if isinstance(response_format, dict):
                    # Do not silently drop schema constraints through the old
                    # SDK's generate fallback. The caller can show grounded
                    # partial analysis if the server is unavailable.
                    break
                # If it's a connection error, try to reconnect
                if "connection" in str(e).lower() or "terminated" in str(e).lower():
                    if attempt < max_retries:
                        import time
                        time.sleep(1)  # Wait 1 second before retry
                        continue

                # Fallback to generate if chat fails
                try:
                    response = ollama.generate(
                        model=self.model,
                        prompt=f"{system_prompt}\n\n{prompt}" if system_prompt else prompt,
                        **({"options": chat_options} if chat_options else {}),
                        **({'format': response_format} if response_format else {}),
                    )
                    return response['response']
                except Exception as e2:
                    last_error = e2
                    if attempt < max_retries:
                        import time
                        time.sleep(1)
                        continue

        # If all retries failed, provide helpful error message
        error_msg = str(last_error) if last_error else "Unknown error"
        if "terminated" in error_msg.lower() or "exit status" in error_msg.lower():
            raise Exception(
                f"Ollama process terminated. Please check:\n"
                f"1. Ollama is running: 'ollama serve' or restart Ollama\n"
                f"2. Model '{self.model}' is installed: 'ollama pull {self.model}'\n"
                f"3. System has enough memory\n"
                f"Original error: {error_msg}"
            )
        raise Exception(f"Ollama API error after {max_retries + 1} attempts: {error_msg}")

    async def chat_response(
            self, question: str, context: Optional[str] = None,
            jlpt_level: Optional[str] = None, response_language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Two bounded attempts at most, then a short safe answer, never bad prose."""
        from .chat_quality import uncertainty
        language=response_language or detect_chat_language(question)
        system=task_prompt(question,language)
        evidence,_,history=(context or '').partition('\n\n[PRIOR_TURNS]\n')
        trusted=evidence.startswith(('[EVIDENCE]\n','Reviewed reference:','**Cấu trúc:**'))
        evidence=evidence.removeprefix('[EVIDENCE]\n')
        start=time.time()
        for attempt in range(2):
            try:
                correction='\nTrả lời thật ngắn, hoàn toàn bằng tiếng Việt.' if language=='vi'else'\nUse one short explanation and one checked example only.'
                strict=system+(correction if attempt else '')
                prompt,budget=bounded_prompt(strict,question,evidence if not attempt or trusted else '',history if not attempt else '',
                    settings.chat_ollama_context,settings.chat_output_tokens,language)
                import logging
                logging.getLogger('senpaiai.chat.metrics').info('prompt_budget %s',json.dumps(budget))
                marker=CHAT_CALL.set(True)
                try:
                    raw=await asyncio.to_thread(self._call_ollama,prompt,strict,
                        temperature=0,num_predict=settings.chat_output_tokens)
                finally:
                    CHAT_CALL.reset(marker)
                # Validate before cleaning so stripped labels cannot hide a violation.
                problems=violations(question,raw,language,evidence)
                if problems:
                    logging.getLogger('senpaiai.chat.metrics').info('validation_failed attempt=%s codes=%s',attempt+1,','.join(problems))
                    continue
                answer=finalize_chat_answer(question,raw,language)
                if violations(question,answer,language,evidence):continue
                return {'answer':answer,'jlpt_level':jlpt_level,'response_time':time.time()-start}
            except ValueError as exc:
                if str(exc)=='chat_question_exceeds_budget':
                    answer=('Câu hỏi vượt ngân sách ngữ cảnh an toàn. Bạn hãy chia thành các đoạn ngắn hơn để mình giải thích.' if language=='vi' else
                            'This question exceeds the safe context budget. Please split it into shorter parts.')
                    return {'answer':answer,'jlpt_level':jlpt_level,'response_time':time.time()-start}
            except IncompleteChatResponse:
                continue
            except Exception as exc:
                # A transport failure is not trustworthy answer content either.
                import logging
                logging.getLogger('senpaiai.chat.metrics').warning('generation_failed model=%s error_type=%s prompt_eval_count=unavailable',self.model,type(exc).__name__)
                continue
        return {'answer':uncertainty(language),'jlpt_level':jlpt_level,'response_time':time.time()-start}


    async def analyze_grammar(self, text: str, include_vietnamese: bool = False,
                              response_language: Optional[str] = None, repair_language: bool = False) -> Dict[str, Any]:
        language = response_language or ('vi' if include_vietnamese else 'en')
        system, prompt = grammar_generation_prompt(text, language)
        points = grounded_patterns(text, language)
        if points:
            prompt += '\nVerified forms in this input (use these explanations; preserve their meaning when translating):\n' + json.dumps(points, ensure_ascii=False)
        if repair_language:
            prompt += ('\nLưu ý: câu trả lời trước chưa đúng ngôn ngữ. Mỗi trường meaning, sentence_meaning, explanation và suggestions phải là tiếng Việt có dấu, không dùng tiếng Anh.' if language == 'vi' else '\nEvery meaning, explanation and suggestion must be in English. Recheck the language of every field.')
        response = await asyncio.to_thread(
            self._call_ollama, prompt, system, temperature=0, max_retries=0,
            response_format=GRAMMAR_SCHEMA,
        )
        match = re.search(r'\{.*\}', response, re.DOTALL)
        result = json.loads(match.group() if match else response)
        if not isinstance(result, dict):
            raise RuntimeError('grammar_analysis_failed')
        return result

    async def translate_text(
            self,
            text: str,
            source_lang: str,
            target_lang: str
    ) -> Dict[str, Any]:
        """Translate text between Japanese and Vietnamese."""
        try:
            system_prompt = """You are a professional Japanese-Vietnamese translator.
            Provide accurate, natural translations while preserving the original meaning and tone.
            For Japanese to Vietnamese: output Vietnamese only. Do not include English headings or explanations.
            For Vietnamese to Japanese: Provide natural Japanese that sounds native.
            Include pronunciation guides (romaji) for Japanese text when helpful."""

            prompt = f"Translate this {source_lang} text to {target_lang}: {text}"
            response = self._call_ollama(prompt, system_prompt)

            translated_text = response.strip()

            return {
                "original_text": text,
                "translated_text": translated_text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "confidence": 0.9  # Placeholder confidence score
            }

        except Exception as e:
            return {
                "original_text": text,
                "translated_text": f"Translation error: {str(e)}",
                "source_lang": source_lang,
                "target_lang": target_lang,
                "confidence": 0.0
            }

    async def predict_jlpt_level(self, text: str) -> str:
        """Predict the JLPT level of Japanese text."""
        try:
            system_prompt = """You are a JLPT level assessment expert. 
            Analyze Japanese text and determine the appropriate JLPT level (N5, N4, N3, N2, N1).
            Consider vocabulary difficulty, grammar complexity, and kanji usage.
            Respond with just the JLPT level (e.g., "N3")."""

            prompt = f"What JLPT level is this text: {text}"
            response = self._call_ollama(prompt, system_prompt)

            level = response.strip()

            # Validate JLPT level format
            if re.match(r'^N[1-5]$', level):
                return level
            else:
                return "N3"  # Default fallback

        except Exception as e:
            return "N3"  # Default fallback

    async def generate_learning_suggestions(
            self,
            user_level: str,
            weak_areas: List[str]
    ) -> List[str]:
        """Generate personalized learning suggestions."""
        try:
            prompt = f"""Based on the user's JLPT level ({user_level}) and weak areas ({', '.join(weak_areas)}), 
            provide 5 specific learning suggestions. Focus on practical, actionable advice."""

            response = self._call_ollama(prompt)

            # Split into individual suggestions
            suggestions = [s.strip() for s in response.split('\n') if s.strip()]
            return suggestions[:5]  # Limit to 5 suggestions

        except Exception as e:
            return [f"Error generating suggestions: {str(e)}"]

    def check_ollama_connection(self) -> bool:
        """Check if Ollama is running and accessible."""
        try:
            # Try to list models - this will fail if Ollama is not running
            response = ollama.list()
            # Also check if the model exists
            raw_models = getattr(response, 'models', None) or (response.get('models', []) if isinstance(response, dict) else [])
            models = []
            for m in raw_models:
                name = getattr(m, 'model', None) or getattr(m, 'name', None) or (m.get('model') or m.get('name') if isinstance(m, dict) else str(m))
                if name:
                    models.append(name)
                    if ':' in name:
                        models.append(name.split(':')[0])
            if self.model not in models:
                print(f"Warning: Model '{self.model}' not found. Available models: {models}")
                print(f"Please run: ollama pull {self.model}")
            return True
        except Exception as e:
            print(f"Ollama connection check failed: {str(e)}")
            return False

    def get_available_models(self) -> List[str]:
        """Get list of available Ollama models."""
        try:
            response = ollama.list()
            raw_models = getattr(response, 'models', None) or (response.get('models', []) if isinstance(response, dict) else [])
            models = []
            for m in raw_models:
                name = getattr(m, 'model', None) or getattr(m, 'name', None) or (m.get('model') or m.get('name') if isinstance(m, dict) else str(m))
                if name:
                    models.append(name)
            return models
        except Exception:
            return []


# Global instance
ollama_service = OllamaJapaneseLearningService()
