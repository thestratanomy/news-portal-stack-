import streamlit as st
import os
from utils.ghost_rag import fetch_single_article, fetch_ghost_articles
from components.chat_ui import render_chat_interface

st.set_page_config(page_title="News AI Assistant", layout="wide")

query_params = st.query_params
active_slug = query_params.get("slug", None)

active_article = None
if active_slug:
    active_article = fetch_single_article(active_slug)

st.title("🤖 News AI Assistant")
st.caption("Powered by Ghost CMS & Python Streamlit")

render_chat_interface(context_article=active_article)
