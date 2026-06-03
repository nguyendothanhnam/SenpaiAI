try:
    from langchain_community.chat_models import ChatOpenAI
except ImportError:
    # Fallback for older versions
    from langchain.chat_models import ChatOpenAI

from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from typing import Dict, List, Any, Optional
import time
import json
import re
from ..core.config import settings
from .ollama_service import ollama_service
from .grammar_analyzer import sanitize_grammar_analysis
from .chat_prompt import CHAT_SYSTEM_PROMPT


class JapaneseLearningService:
    def __init__(self):
        self.provider = settings.llm_provider

        if self.provider == "ollama":
            self.service = ollama_service
        else:
            # Fallback to OpenAI
            self.llm = ChatOpenAI(
                openai_api_key=settings.openai_api_key,
                model_name="gpt-3.5-turbo",
                temperature=0.7,
                max_tokens=1000
            )
            self._setup_prompts()

    def _setup_prompts(self):
        """Setup all the prompt templates."""

        # Chat prompt for general Q&A
        self.chat_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=CHAT_SYSTEM_PROMPT),
            HumanMessage(content="{question}")
        ])

        # Grammar analysis prompt
        self.grammar_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are HineGoldAI, a Japanese grammar expert for Vietnamese learners.
            Analyze only the given Japanese text. Never invent meanings. If a word is uncertain, write "Chưa chắc chắn về từ này".
            Do not treat vocabulary items as grammar patterns.
            If Vietnamese is requested, use Vietnamese for all explanations and suggestions. Do not use English unless requested.
            Difficulty score must match JLPT level: N5 simple questions 2-3/10, N4 4/10, N3 5-6/10, N2 7-8/10, N1 9-10/10.

            Format your response as JSON with these fields:
            - sentence_meaning: string
            - vocabulary: array of objects with 'term', 'meaning', 'jlpt_level'
            - grammar_patterns: array of objects with 'pattern', 'explanation', 'example'
            - grammar_points: same array as grammar_patterns
            - jlpt_level: string
            - difficulty_score: number
            - suggestions: array of Japanese-learning suggestions related to the text"""),
            HumanMessage(content="Vietnamese requested: {include_vietnamese}\nAnalyze this Japanese text: {text}")
        ])

        # Translation prompt
        self.translation_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are a professional Japanese-Vietnamese translator.
            Provide accurate, natural translations while preserving the original meaning and tone.
            For Japanese to Vietnamese: Provide both literal and natural translations.
            For Vietnamese to Japanese: Provide natural Japanese that sounds native.
            Include pronunciation guides (romaji) for Japanese text when helpful."""),
            HumanMessage(content="Translate this {source_lang} text to {target_lang}: {text}")
        ])

        # JLPT level prediction prompt
        self.jlpt_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are a JLPT level assessment expert. 
            Analyze Japanese text and determine the appropriate JLPT level (N5, N4, N3, N2, N1).
            Consider vocabulary difficulty, grammar complexity, and kanji usage.
            Respond with just the JLPT level (e.g., "N3")."""),
            HumanMessage(content="What JLPT level is this text: {text}")
        ])

    async def chat_response(
            self,
            question: str,
            context: Optional[str] = None,
            jlpt_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a chat response with RAG context."""
        if self.provider == "ollama":
            return await self.service.chat_response(question, context, jlpt_level)

        # OpenAI implementation
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

            # Generate response
            messages = self.chat_prompt.format_messages(question=enhanced_question)
            response = await self.llm.agenerate([messages])

            answer = response.generations[0][0].text.strip()

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
                "answer": f"Xin lỗi, mình gặp lỗi khi xử lý câu hỏi: {str(e)}",
                "jlpt_level": None,
                "response_time": time.time() - start_time
            }

    async def analyze_grammar(self, text: str, include_vietnamese: bool = False) -> Dict[str, Any]:
        """Analyze Japanese grammar in the given text."""
        if self.provider == "ollama":
            return await self.service.analyze_grammar(text, include_vietnamese=include_vietnamese)

        # OpenAI implementation
        try:
            messages = self.grammar_prompt.format_messages(text=text, include_vietnamese=include_vietnamese)
            response = await self.llm.agenerate([messages])

            result_text = response.generations[0][0].text.strip()

            # Try to parse JSON response
            try:
                result = json.loads(result_text)

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
                    "grammar_points": [],
                    "grammar_patterns": [],
                    "difficulty_score": 5.0,
                    "suggestions": ["Ôn lại các mẫu ngữ pháp xuất hiện trong câu"]
                }

            return sanitize_grammar_analysis(text, result, include_vietnamese=include_vietnamese)

        except Exception as e:
            return sanitize_grammar_analysis(text, {
                "jlpt_level": "N3",
                "grammar_points": [],
                "difficulty_score": 5.0,
                "suggestions": []
            }, include_vietnamese=include_vietnamese)

    async def translate_text(
            self,
            text: str,
            source_lang: str,
            target_lang: str
    ) -> Dict[str, Any]:
        """Translate text between Japanese and Vietnamese."""
        if self.provider == "ollama":
            return await self.service.translate_text(text, source_lang, target_lang)

        # OpenAI implementation
        try:
            messages = self.translation_prompt.format_messages(
                text=text,
                source_lang=source_lang,
                target_lang=target_lang
            )
            response = await self.llm.agenerate([messages])

            translated_text = response.generations[0][0].text.strip()

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
        if self.provider == "ollama":
            return await self.service.predict_jlpt_level(text)

        # OpenAI implementation
        try:
            messages = self.jlpt_prompt.format_messages(text=text)
            response = await self.llm.agenerate([messages])

            level = response.generations[0][0].text.strip()

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
        if self.provider == "ollama":
            return await self.service.generate_learning_suggestions(user_level, weak_areas)

        # OpenAI implementation
        try:
            prompt = f"""Based on the user's JLPT level ({user_level}) and weak areas ({', '.join(weak_areas)}), 
            provide 5 specific learning suggestions. Focus on practical, actionable advice."""

            messages = [HumanMessage(content=prompt)]
            response = await self.llm.agenerate([messages])

            suggestions_text = response.generations[0][0].text.strip()

            # Split into individual suggestions
            suggestions = [s.strip() for s in suggestions_text.split('\n') if s.strip()]
            return suggestions[:5]  # Limit to 5 suggestions

        except Exception as e:
            return [f"Error generating suggestions: {str(e)}"]


# Global instance
japanese_service = JapaneseLearningService()
