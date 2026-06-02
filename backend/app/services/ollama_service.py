from typing import Dict, List, Any, Optional
import time
import json
import re
import ollama
from ..core.config import settings


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

    def _call_ollama(self, prompt: str, system_prompt: str = None, max_retries: int = 2) -> str:
        """Call Ollama API directly with retry logic."""
        # Check Ollama connection first
        if not self.check_ollama_connection():
            raise Exception("Ollama is not running. Please start Ollama service.")

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})

                response = ollama.chat(
                    model=self.model,
                    messages=messages
                )
                return response['message']['content']
            except Exception as e:
                last_error = e
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
                        prompt=f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
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
            self,
            question: str,
            context: Optional[str] = None,
            jlpt_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a chat response with RAG context."""
        start_time = time.time()

        try:
            # Prepare the question with context
            if context:
                enhanced_question = f"Context: {context}\n\nQuestion: {question}"
            else:
                enhanced_question = question

            # Add JLPT level context if provided
            if jlpt_level:
                enhanced_question = f"User's JLPT level: {jlpt_level}\n\n{enhanced_question}"

            # Generate response using Ollama
            system_prompt = """You are HineGoldAI, a helpful Japanese learning assistant. 
            You provide accurate, educational responses about Japanese language, culture, and grammar.
            Always include relevant examples and explanations suitable for the user's JLPT level.
            If asked about grammar, provide detailed explanations with usage patterns.
            If asked for translations, provide both literal and natural translations.
            Answer the exact current question first, before adding related context.
            For multiple-choice questions, choose one option first, then explain briefly.
            Never replace the user's target Japanese word with a similar word.
            If you are unsure, say you are unsure instead of guessing.
            Retrieved context is supporting material only; it must not override the user's current question.
            Use polite, encouraging language and include cultural context when relevant.
            Respond in a helpful and educational manner."""

            answer = self._call_ollama(enhanced_question, system_prompt).strip()

            # Predict JLPT level of the response
            jlpt_prediction = await self.predict_jlpt_level(answer)

            response_time = time.time() - start_time

            return {
                "answer": answer,
                "jlpt_level": jlpt_prediction,
                "response_time": response_time
            }

        except Exception as e:
            return {
                "answer": f"I apologize, but I encountered an error: {str(e)}",
                "jlpt_level": None,
                "response_time": time.time() - start_time
            }

    async def analyze_grammar(self, text: str) -> Dict[str, Any]:
        """Analyze Japanese grammar in the given text."""
        try:
            system_prompt = """You are a Japanese grammar expert. Analyze the given Japanese text and provide:
            1. JLPT level assessment (N5-N1)
            2. Grammar points with explanations
            3. Difficulty score (0-10)
            4. Learning suggestions

            Format your response as JSON with these fields:
            - jlpt_level: string
            - grammar_points: array of objects with 'pattern', 'explanation', 'example'
            - difficulty_score: number
            - suggestions: array of strings"""

            prompt = f"Analyze this Japanese text: {text}"
            response = self._call_ollama(prompt, system_prompt)

            # Try to parse JSON response
            try:
                # Extract JSON from response if it's wrapped in text
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    result = json.loads(response)

                # Ensure grammar_points is always an array
                if "grammar_points" in result:
                    if not isinstance(result["grammar_points"], list):
                        # If it's a single object, wrap it in an array
                        if isinstance(result["grammar_points"], dict):
                            result["grammar_points"] = [result["grammar_points"]]
                        else:
                            result["grammar_points"] = []
                else:
                    result["grammar_points"] = []

                # Ensure suggestions is always an array
                if "suggestions" in result:
                    if not isinstance(result["suggestions"], list):
                        result["suggestions"] = [str(result["suggestions"])] if result["suggestions"] else []
                else:
                    result["suggestions"] = []

            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                result = {
                    "jlpt_level": "N3",
                    "grammar_points": [{"pattern": "Unknown", "explanation": response, "example": ""}],
                    "difficulty_score": 5.0,
                    "suggestions": ["Review basic grammar patterns"]
                }

            return result

        except Exception as e:
            return {
                "jlpt_level": "N3",
                "grammar_points": [],
                "difficulty_score": 5.0,
                "suggestions": [f"Error in analysis: {str(e)}"]
            }

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
            For Japanese to Vietnamese: Provide both literal and natural translations.
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
            models = [model['name'] for model in response.get('models', [])]
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
            return [model['name'] for model in response['models']]
        except Exception:
            return []


# Global instance
ollama_service = OllamaJapaneseLearningService()
