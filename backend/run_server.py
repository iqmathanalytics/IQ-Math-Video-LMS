import sys
import asyncio
import uvicorn
import uvicorn.loops.asyncio as uvicorn_asyncio


def selector_loop_factory(use_subprocess: bool = False):
    # uvicorn's auto loop calls this with use_subprocess and expects a
    # loop class. Selector avoids the Windows Proactor TLS failure
    # (WinError 87) against TiDB.
    return asyncio.SelectorEventLoop


def main() -> None:
    # Uvicorn 0.36+ ignores the Windows selector policy and builds a Proactor
    # loop, which breaks TiDB TLS with WinError 87. Force the selector loop.
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        uvicorn_asyncio.asyncio_loop_factory = selector_loop_factory

    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=False)


if __name__ == "__main__":
    main()
