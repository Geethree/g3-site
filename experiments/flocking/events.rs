//! Keep browser callbacks alive until this page is left.
use wasm_bindgen::{JsCast, prelude::*};
use web_sys::{Document, Element, Event, EventTarget};

pub fn element(document: &Document, id: &str) -> Result<Element, JsValue> {
    document
        .get_element_by_id(id)
        .ok_or_else(|| format!("Missing element: {id}").into())
}
pub fn listen<E: JsCast + 'static>(
    target: &EventTarget,
    name: &str,
    mut action: impl FnMut(E) + 'static,
) -> Result<(), JsValue> {
    let callback = Closure::<dyn FnMut(Event)>::new(move |event: Event| {
        if let Ok(event) = event.dyn_into::<E>() {
            action(event);
        }
    });
    target.add_event_listener_with_callback(name, callback.as_ref().unchecked_ref())?;
    callback.forget();
    Ok(())
}
