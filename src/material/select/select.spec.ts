import {Directionality} from '@angular/cdk/bidi';
import {
  DOWN_ARROW,
  END,
  ENTER,
  HOME,
  LEFT_ARROW,
  RIGHT_ARROW,
  SPACE,
  TAB,
  UP_ARROW,
  A,
  ESCAPE,
} from '@angular/cdk/keycodes';
import {OverlayContainer} from '@angular/cdk/overlay';
import {Platform} from '@angular/cdk/platform';
import {ScrollDispatcher, ViewportRuler} from '@angular/cdk/scrolling';
import {
  createKeyboardEvent,
  dispatchEvent,
  dispatchFakeEvent,
  dispatchKeyboardEvent,
  wrappedErrorMessage,
} from '../../cdk/testing/private';
import {
  ChangeDetectionStrategy,
  Component,
  DebugElement,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  Provider,
} from '@angular/core';
import {
  waitForAsync,
  ComponentFixture,
  fakeAsync,
  flush,
  inject,
  TestBed,
  tick,
} from '@angular/core/testing';
import {
  ControlValueAccessor,
  FormControl,
  FormGroup,
  FormGroupDirective,
  FormsModule,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ErrorStateMatcher,
  MatOption,
  MatOptionSelectionChange,
} from '@angular/material/core';
import {
  FloatLabelType,
  MatFormFieldModule,
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
} from '@angular/material/form-field';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {LiveAnnouncer} from '@angular/cdk/a11y';
import {Subject, Subscription, EMPTY, Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {MatSelectModule} from './index';
import {MatSelect, MAT_SELECT_CONFIG, MatSelectConfig} from './select';
import {
  getMatSelectDynamicMultipleError,
  getMatSelectNonArrayValueError,
  getMatSelectNonFunctionValueError,
} from './select-errors';


/** Default debounce interval when typing letters to select an option. */
const DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL = 200;

describe('MatSelect', () => {
  let overlayContainerElement: HTMLElement;
  let dir: {value: 'ltr'|'rtl', change: Observable<string>};
  let scrolledSubject = new Subject();
  let viewportRuler: ViewportRuler;
  let platform: Platform;

  /**
   * Configures the test module for MatSelect with the given declarations. This is broken out so
   * that we're only compiling the necessary test components for each test in order to speed up
   * overall test time.
   * @param declarations Components to declare for this block
   * @param providers Additional providers for this block
   */
  function configureMatSelectTestingModule(declarations: any[], providers: Provider[] = []) {
    TestBed.configureTestingModule({
      imports: [
        MatFormFieldModule,
        MatSelectModule,
        ReactiveFormsModule,
        FormsModule,
        NoopAnimationsModule,
      ],
      declarations: declarations,
      providers: [
        {provide: Directionality, useFactory: () => dir = {value: 'ltr', change: EMPTY}},
        {
          provide: ScrollDispatcher, useFactory: () => ({
            scrolled: () => scrolledSubject,
          }),
        },
        ...providers
      ],
    }).compileComponents();

    inject([OverlayContainer, Platform], (oc: OverlayContainer, p: Platform) => {
      overlayContainerElement = oc.getContainerElement();
      platform = p;
    })();
  }

  describe('core', () => {
    beforeEach(waitForAsync(() => {
      configureMatSelectTestingModule([
        BasicSelect,
        MultiSelect,
        SelectWithGroups,
        SelectWithGroupsAndNgContainer,
        SelectWithFormFieldLabel,
        SelectWithChangeEvent,
      ]);
    }));

    describe('accessibility', () => {
      describe('for select', () => {
        let fixture: ComponentFixture<BasicSelect>;
        let select: HTMLElement;

        beforeEach(fakeAsync(() => {
          fixture = TestBed.createComponent(BasicSelect);
          fixture.detectChanges();
          select = fixture.debugElement.query(By.css('mat-select'))!.nativeElement;
        }));

        it('should set the role of the select to combobox', fakeAsync(() => {
          expect(select.getAttribute('role')).toEqual('combobox');
          expect(select.getAttribute('aria-autocomplete')).toBe('none');
          expect(select.getAttribute('aria-haspopup')).toBe('true');
        }));

        it('should point the aria-controls attribute to the listbox', fakeAsync(() => {
          expect(select.hasAttribute('aria-controls')).toBe(false);

          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          const ariaControls = select.getAttribute('aria-controls');
          expect(ariaControls).toBeTruthy();
          expect(ariaControls).toBe(document.querySelector('.mat-select-panel')!.id);
        }));

        it('should point the aria-owns attribute to the listbox on the trigger', fakeAsync(() => {
          const trigger = select.querySelector('.mat-select-trigger')!;
          expect(trigger.hasAttribute('aria-owns')).toBe(false);

          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          const ariaOwns = trigger.getAttribute('aria-owns');
          expect(ariaOwns).toBeTruthy();
          expect(ariaOwns).toBe(document.querySelector('.mat-select-panel')!.id);
        }));

        it('should set aria-expanded based on the select open state', fakeAsync(() => {
          expect(select.getAttribute('aria-expanded')).toBe('false');

          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          expect(select.getAttribute('aria-expanded')).toBe('true');
        }));

        it('should support setting a custom aria-label', fakeAsync(() => {
          fixture.componentInstance.ariaLabel = 'Custom Label';
          fixture.detectChanges();

          expect(select.getAttribute('aria-label')).toEqual('Custom Label');
          expect(select.hasAttribute('aria-labelledby')).toBeFalsy();
        }));

        it('should be able to add an extra aria-labelledby on top of the default', fakeAsync(() => {
          fixture.componentInstance.ariaLabelledby = 'myLabelId';
          fixture.detectChanges();

          const labelId = fixture.nativeElement.querySelector('.mat-form-field-label').id;
          const valueId = fixture.nativeElement.querySelector('.mat-select-value').id;

          expect(select.getAttribute('aria-labelledby')).toBe(`${labelId} ${valueId} myLabelId`);
        }));

        it('should set aria-labelledby to the value and label IDs', fakeAsync(() => {
          fixture.detectChanges();

          const labelId = fixture.nativeElement.querySelector('.mat-form-field-label').id;
          const valueId = fixture.nativeElement.querySelector('.mat-select-value').id;
          expect(select.getAttribute('aria-labelledby')).toBe(`${labelId} ${valueId}`);
        }));

        it('should trim the trigger aria-labelledby when there is no label', fakeAsync(() => {
          // Reset the `placeholder` which also controls the label of the form field.
          fixture.componentInstance.select.placeholder = '';
          fixture.detectChanges();

          // Note that we assert that there are no spaces around the value.
          const valueId = fixture.nativeElement.querySelector('.mat-select-value').id;
          expect(select.getAttribute('aria-labelledby')).toBe(`${valueId}`);
        }));

        it('should set the tabindex of the select to 0 by default', fakeAsync(() => {
          expect(select.getAttribute('tabindex')).toEqual('0');
        }));

        it('should be able to override the tabindex', fakeAsync(() => {
          fixture.componentInstance.tabIndexOverride = 3;
          fixture.detectChanges();

          expect(select.getAttribute('tabindex')).toBe('3');
        }));

        it('should set aria-required for required selects', fakeAsync(() => {
          expect(select.getAttribute('aria-required'))
            .withContext(`Expected aria-required attr to be false for normal selects.`)
            .toEqual('false');

          fixture.componentInstance.isRequired = true;
          fixture.detectChanges();

          expect(select.getAttribute('aria-required'))
            .withContext(`Expected aria-required attr to be true for required selects.`)
            .toEqual('true');
        }));

        it('should set the mat-select-required class for required selects', fakeAsync(() => {
          expect(select.classList).not.toContain(
              'mat-select-required', `Expected the mat-select-required class not to be set.`);

          fixture.componentInstance.isRequired = true;
          fixture.detectChanges();

          expect(select.classList)
            .withContext(`Expected the mat-select-required class to be set.`)
            .toContain('mat-select-required');
        }));

        it('should set aria-invalid for selects that are invalid and touched', fakeAsync(() => {
          expect(select.getAttribute('aria-invalid'))
            .withContext(`Expected aria-invalid attr to be false for valid selects.`)
            .toEqual('false');

          fixture.componentInstance.isRequired = true;
          fixture.componentInstance.control.markAsTouched();
          fixture.detectChanges();

          expect(select.getAttribute('aria-invalid'))
            .withContext(`Expected aria-invalid attr to be true for invalid selects.`)
            .toEqual('true');
        }));

        it('should set aria-disabled for disabled selects', fakeAsync(() => {
          expect(select.getAttribute('aria-disabled')).toEqual('false');

          fixture.componentInstance.control.disable();
          fixture.detectChanges();

          expect(select.getAttribute('aria-disabled')).toEqual('true');
        }));

        it('should set the tabindex of the select to -1 if disabled', fakeAsync(() => {
          fixture.componentInstance.control.disable();
          fixture.detectChanges();
          expect(select.getAttribute('tabindex')).toEqual('-1');

          fixture.componentInstance.control.enable();
          fixture.detectChanges();
          expect(select.getAttribute('tabindex')).toEqual('0');
        }));

        it('should set `aria-labelledby` to the value ID if there is no form field', () => {
          fixture.destroy();

          const labelFixture = TestBed.createComponent(SelectWithChangeEvent);
          labelFixture.detectChanges();
          select = labelFixture.debugElement.query(By.css('mat-select'))!.nativeElement;
          const valueId = labelFixture.nativeElement.querySelector('.mat-select-value').id;

          expect(select.getAttribute('aria-labelledby')?.trim()).toBe(valueId);
        });

        it('should select options via the UP/DOWN arrow keys on a closed select', fakeAsync(() => {
          const formControl = fixture.componentInstance.control;
          const options = fixture.componentInstance.options.toArray();

          expect(formControl.value).withContext('Expected no initial value.').toBeFalsy();

          dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);

          expect(options[0].selected)
            .withContext('Expected first option to be selected.').toBe(true);
          expect(formControl.value)
            .withContext('Expected value from first option to have been set on the model.')
            .toBe(options[0].value);

          dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
          dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);

          // Note that the third option is skipped, because it is disabled.
          // Note that the third option is skipped, because it is disabled.
          expect(options[3].selected)
            .withContext('Expected fourth option to be selected.').toBe(true);
          expect(formControl.value)
            .withContext('Expected value from fourth option to have been set on the model.')
            .toBe(options[3].value);

          dispatchKeyboardEvent(select, 'keydown', UP_ARROW);

          expect(options[1].selected)
            .withContext('Expected second option to be selected.').toBe(true);
          expect(formControl.value)
            .withContext('Expected value from second option to have been set on the model.')
            .toBe(options[1].value);

          flush();
        }));

        it('should go back to first option if value is reset after interacting using the' +
          'arrow keys on a closed select', fakeAsync(() => {
            const formControl = fixture.componentInstance.control;
            const options = fixture.componentInstance.options.toArray();

            expect(formControl.value).withContext('Expected no initial value.').toBeFalsy();

            dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
            flush();

            expect(options[0].selected)
              .withContext('Expected first option to be selected.').toBe(true);
            expect(formControl.value)
              .withContext('Expected value from first option to have been set on the model.')
              .toBe(options[0].value);

            formControl.reset();
            fixture.detectChanges();

            expect(options[0].selected)
              .withContext('Expected first option to be deselected.').toBe(false);
            expect(formControl.value)
              .withContext('Expected value to be reset.').toBeFalsy();

            dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
            flush();

            expect(options[0].selected)
              .withContext('Expected first option to be selected again.').toBe(true);
            expect(formControl.value)
              .withContext('Expected value from first option to have been set on the model again.')
              .toBe(options[0].value);
        }));

        it('should select first/last options via the HOME/END keys on a closed select',
          fakeAsync(() => {
            const formControl = fixture.componentInstance.control;
            const firstOption = fixture.componentInstance.options.first;
            const lastOption = fixture.componentInstance.options.last;

            expect(formControl.value).withContext('Expected no initial value.').toBeFalsy();

            const endEvent = dispatchKeyboardEvent(select, 'keydown', END);

            expect(endEvent.defaultPrevented).toBe(true);
            expect(lastOption.selected)
              .withContext('Expected last option to be selected.').toBe(true);
            expect(formControl.value)
              .withContext('Expected value from last option to have been set on the model.')
              .toBe(lastOption.value);

            const homeEvent = dispatchKeyboardEvent(select, 'keydown', HOME);

            expect(homeEvent.defaultPrevented).toBe(true);
            expect(firstOption.selected)
              .withContext('Expected first option to be selected.').toBe(true);
            expect(formControl.value)
              .withContext('Expected value from first option to have been set on the model.')
              .toBe(firstOption.value);

            flush();
          }));

        it('should resume focus from selected item after selecting via click', fakeAsync(() => {
          const formControl = fixture.componentInstance.control;
          const options = fixture.componentInstance.options.toArray();

          expect(formControl.value).withContext('Expected no initial value.').toBeFalsy();

          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          (overlayContainerElement.querySelectorAll('mat-option')[3] as HTMLElement).click();
          fixture.detectChanges();
          flush();

          expect(formControl.value).toBe(options[3].value);

          dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
          fixture.detectChanges();

          expect(formControl.value).toBe(options[4].value);
          flush();
        }));

        it('should select options via LEFT/RIGHT arrow keys on a closed select', fakeAsync(() => {
          const formControl = fixture.componentInstance.control;
          const options = fixture.componentInstance.options.toArray();

          expect(formControl.value).withContext('Expected no initial value.').toBeFalsy();

          dispatchKeyboardEvent(select, 'keydown', RIGHT_ARROW);

          expect(options[0].selected)
            .withContext('Expected first option to be selected.').toBe(true);
          expect(formControl.value)
            .withContext('Expected value from first option to have been set on the model.')
            .toBe(options[0].value);

          dispatchKeyboardEvent(select, 'keydown', RIGHT_ARROW);
          dispatchKeyboardEvent(select, 'keydown', RIGHT_ARROW);

          // Note that the third option is skipped, because it is disabled.
          // Note that the third option is skipped, because it is disabled.
          expect(options[3].selected)
            .withContext('Expected fourth option to be selected.').toBe(true);
          expect(formControl.value)
            .withContext('Expected value from fourth option to have been set on the model.')
            .toBe(options[3].value);

          dispatchKeyboardEvent(select, 'keydown', LEFT_ARROW);

          expect(options[1].selected)
            .withContext('Expected second option to be selected.').toBe(true);
          expect(formControl.value)
            .withContext('Expected value from second option to have been set on the model.')
            .toBe(options[1].value);
          flush();
        }));

        it('should announce changes via the keyboard on a closed select',
          fakeAsync(inject([LiveAnnouncer], (liveAnnouncer: LiveAnnouncer) => {
          spyOn(liveAnnouncer, 'announce');

          dispatchKeyboardEvent(select, 'keydown', RIGHT_ARROW);

          expect(liveAnnouncer.announce).toHaveBeenCalledWith('Steak', jasmine.any(Number));

          flush();
        })));

        it('should not throw when reaching a reset option using the arrow keys on a closed select',
           fakeAsync(() => {
             fixture.componentInstance.foods =
                 [{value: 'steak-0', viewValue: 'Steak'}, {value: null, viewValue: 'None'}];
             fixture.detectChanges();
             fixture.componentInstance.control.setValue('steak-0');

             expect(() => {
               dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
               fixture.detectChanges();
             }).not.toThrow();

             flush();
           }));

        it('should open a single-selection select using ALT + DOWN_ARROW', fakeAsync(() => {
          const {control: formControl, select: selectInstance} = fixture.componentInstance;

          expect(selectInstance.panelOpen)
            .withContext('Expected select to be closed.').toBe(false);
          expect(formControl.value).withContext('Expected no initial value.').toBeFalsy();

          const event = createKeyboardEvent('keydown', DOWN_ARROW, undefined, {alt: true});

          dispatchEvent(select, event);

          expect(selectInstance.panelOpen)
            .withContext('Expected select to be open.').toBe(true);
          expect(formControl.value).withContext('Expected value not to have changed.').toBeFalsy();
        }));

        it('should open a single-selection select using ALT + UP_ARROW', fakeAsync(() => {
          const {control: formControl, select: selectInstance} = fixture.componentInstance;

          expect(selectInstance.panelOpen)
            .withContext('Expected select to be closed.').toBe(false);
          expect(formControl.value).withContext('Expected no initial value.').toBeFalsy();

          const event = createKeyboardEvent('keydown', UP_ARROW, undefined, {alt: true});

          dispatchEvent(select, event);

          expect(selectInstance.panelOpen)
            .withContext('Expected select to be open.').toBe(true);
          expect(formControl.value).withContext('Expected value not to have changed.').toBeFalsy();
        }));

        it('should close when pressing ALT + DOWN_ARROW', fakeAsync(() => {
          const {select: selectInstance} = fixture.componentInstance;

          selectInstance.open();
          fixture.detectChanges();

          expect(selectInstance.panelOpen)
            .withContext('Expected select to be open.').toBe(true);

          const event = createKeyboardEvent('keydown', DOWN_ARROW, undefined, {alt: true});

          dispatchEvent(select, event);

          expect(selectInstance.panelOpen)
            .withContext('Expected select to be closed.').toBe(false);
          expect(event.defaultPrevented)
            .withContext('Expected default action to be prevented.').toBe(true);
        }));

        it('should close when pressing ALT + UP_ARROW', fakeAsync(() => {
          const {select: selectInstance} = fixture.componentInstance;

          selectInstance.open();
          fixture.detectChanges();

          expect(selectInstance.panelOpen)
            .withContext('Expected select to be open.').toBe(true);

          const event = createKeyboardEvent('keydown', UP_ARROW, undefined, {alt: true});

          dispatchEvent(select, event);

          expect(selectInstance.panelOpen)
            .withContext('Expected select to be closed.').toBe(false);
          expect(event.defaultPrevented)
            .withContext('Expected default action to be prevented.').toBe(true);
        }));

        it('should be able to select options by typing on a closed select', fakeAsync(() => {
          const formControl = fixture.componentInstance.control;
          const options = fixture.componentInstance.options.toArray();

          expect(formControl.value).withContext('Expected no initial value.').toBeFalsy();

          dispatchEvent(select, createKeyboardEvent('keydown', 80, 'p'));
          tick(DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL);

          expect(options[1].selected)
            .withContext('Expected second option to be selected.').toBe(true);
          expect(formControl.value)
            .withContext('Expected value from second option to have been set on the model.')
            .toBe(options[1].value);

          dispatchEvent(select, createKeyboardEvent('keydown', 69, 'e'));
          tick(DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL);

          expect(options[5].selected)
            .withContext('Expected sixth option to be selected.').toBe(true);
          expect(formControl.value)
            .withContext('Expected value from sixth option to have been set on the model.')
            .toBe(options[5].value);
        }));

        it('should not open the select when pressing space while typing', fakeAsync(() => {
          const selectInstance = fixture.componentInstance.select;

          fixture.componentInstance.typeaheadDebounceInterval = DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL;
          fixture.detectChanges();

          expect(selectInstance.panelOpen)
            .withContext('Expected select to be closed on init.').toBe(false);

          dispatchEvent(select, createKeyboardEvent('keydown', 80, 'p'));
          tick(DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL / 2);
          fixture.detectChanges();

          dispatchKeyboardEvent(select, 'keydown', SPACE);
          fixture.detectChanges();

          expect(selectInstance.panelOpen)
            .withContext('Expected select to remain closed after space was pressed.').toBe(false);

          tick(DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL / 2);
          fixture.detectChanges();

          expect(selectInstance.panelOpen)
            .withContext('Expected select to be closed when the timer runs out.').toBe(false);
        }));

        it('should be able to customize the typeahead debounce interval', fakeAsync(() => {
          const formControl = fixture.componentInstance.control;
          const options = fixture.componentInstance.options.toArray();

          fixture.componentInstance.typeaheadDebounceInterval = 1337;
          fixture.detectChanges();

          expect(formControl.value).withContext('Expected no initial value.').toBeFalsy();

          dispatchEvent(select, createKeyboardEvent('keydown', 80, 'p'));
          tick(DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL);

          expect(formControl.value)
            .withContext('Expected no value after a bit of time has passed.').toBeFalsy();

          tick(1337);

          expect(options[1].selected)
            .withContext('Expected second option to be selected after all the time has passed.')
            .toBe(true);
          expect(formControl.value)
            .withContext('Expected value from second option to have been set on the model.')
            .toBe(options[1].value);
        }));

        it('should open the panel when pressing a vertical arrow key on a closed multiple select',
          fakeAsync(() => {
            fixture.destroy();

            const multiFixture = TestBed.createComponent(MultiSelect);
            const instance = multiFixture.componentInstance;

            multiFixture.detectChanges();
            select = multiFixture.debugElement.query(By.css('mat-select'))!.nativeElement;

            const initialValue = instance.control.value;

            expect(instance.select.panelOpen)
              .withContext('Expected panel to be closed.').toBe(false);

            const event = dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);

            expect(instance.select.panelOpen)
              .withContext('Expected panel to be open.').toBe(true);
            expect(instance.control.value)
              .withContext('Expected value to stay the same.').toBe(initialValue);
            expect(event.defaultPrevented)
              .withContext('Expected default to be prevented.').toBe(true);
          }));

        it('should open the panel when pressing a horizontal arrow key on closed multiple select',
          fakeAsync(() => {
            fixture.destroy();

            const multiFixture = TestBed.createComponent(MultiSelect);
            const instance = multiFixture.componentInstance;

            multiFixture.detectChanges();
            select = multiFixture.debugElement.query(By.css('mat-select'))!.nativeElement;

            const initialValue = instance.control.value;

            expect(instance.select.panelOpen)
              .withContext('Expected panel to be closed.').toBe(false);

            const event = dispatchKeyboardEvent(select, 'keydown', RIGHT_ARROW);

            expect(instance.select.panelOpen)
              .withContext('Expected panel to be open.').toBe(true);
            expect(instance.control.value)
              .withContext('Expected value to stay the same.').toBe(initialValue);
            expect(event.defaultPrevented)
              .withContext('Expected default to be prevented.').toBe(true);
          }));

        it('should do nothing when typing on a closed multi-select', fakeAsync(() => {
          fixture.destroy();

          const multiFixture = TestBed.createComponent(MultiSelect);
          const instance = multiFixture.componentInstance;

          multiFixture.detectChanges();
          select = multiFixture.debugElement.query(By.css('mat-select'))!.nativeElement;

          const initialValue = instance.control.value;

          expect(instance.select.panelOpen)
            .withContext('Expected panel to be closed.').toBe(false);

          dispatchEvent(select, createKeyboardEvent('keydown', 80, 'p'));

          expect(instance.select.panelOpen)
            .withContext('Expected panel to stay closed.').toBe(false);
          expect(instance.control.value)
            .withContext('Expected value to stay the same.').toBe(initialValue);
        }));

        it('should do nothing if the key manager did not change the active item', fakeAsync(() => {
          const formControl = fixture.componentInstance.control;

          expect(formControl.value)
            .withContext('Expected form control value to be empty.').toBeNull();
          expect(formControl.pristine)
            .withContext('Expected form control to be clean.').toBe(true);

          dispatchKeyboardEvent(select, 'keydown', 16); // Press a random key.

          expect(formControl.value)
            .withContext('Expected form control value to stay empty.').toBeNull();
          expect(formControl.pristine)
            .withContext('Expected form control to stay clean.').toBe(true);
        }));

        it('should continue from the selected option when the value is set programmatically',
            fakeAsync(() => {
              const formControl = fixture.componentInstance.control;

              formControl.setValue('eggs-5');
              fixture.detectChanges();

              dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);

              expect(formControl.value).toBe('pasta-6');
              expect(fixture.componentInstance.options.toArray()[6].selected).toBe(true);
              flush();
            }));

        it('should not shift focus when the selected options are updated programmatically ' +
            'in a multi select', fakeAsync(() => {
          fixture.destroy();

          const multiFixture = TestBed.createComponent(MultiSelect);

          multiFixture.detectChanges();
          select = multiFixture.debugElement.query(By.css('mat-select'))!.nativeElement;
          multiFixture.componentInstance.select.open();
          multiFixture.detectChanges();

          const options =
              overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;

          options[3].focus();
          expect(document.activeElement)
            .withContext('Expected fourth option to be focused.').toBe(options[3]);

          multiFixture.componentInstance.control.setValue(['steak-0', 'sushi-7']);
          multiFixture.detectChanges();

          expect(document.activeElement)
            .withContext('Expected fourth option to remain focused.').toBe(options[3]);
        }));

        it('should not cycle through the options if the control is disabled', fakeAsync(() => {
          const formControl = fixture.componentInstance.control;

          formControl.setValue('eggs-5');
          formControl.disable();

          dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);

          expect(formControl.value)
            .withContext('Expected value to remain unchaged.').toBe('eggs-5');
        }));

        it('should not wrap selection after reaching the end of the options', fakeAsync(() => {
          const lastOption = fixture.componentInstance.options.last;

          fixture.componentInstance.options.forEach(() => {
            dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
          });

          expect(lastOption.selected)
            .withContext('Expected last option to be selected.').toBe(true);

          dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);

          expect(lastOption.selected)
            .withContext('Expected last option to stay selected.').toBe(true);

          flush();
        }));

        it('should not open a multiple select when tabbing through', fakeAsync(() => {
          fixture.destroy();

          const multiFixture = TestBed.createComponent(MultiSelect);

          multiFixture.detectChanges();
          select = multiFixture.debugElement.query(By.css('mat-select'))!.nativeElement;

          expect(multiFixture.componentInstance.select.panelOpen)
            .withContext('Expected panel to be closed initially.').toBe(false);

          dispatchKeyboardEvent(select, 'keydown', TAB);

          expect(multiFixture.componentInstance.select.panelOpen)
            .withContext('Expected panel to stay closed.').toBe(false);
        }));

        it('should toggle the next option when pressing shift + DOWN_ARROW on a multi-select',
          fakeAsync(() => {
            fixture.destroy();

            const multiFixture = TestBed.createComponent(MultiSelect);
            const event = createKeyboardEvent('keydown', DOWN_ARROW, undefined, {shift: true});

            multiFixture.detectChanges();
            select = multiFixture.debugElement.query(By.css('mat-select'))!.nativeElement;

            multiFixture.componentInstance.select.open();
            multiFixture.detectChanges();
            flush();

            expect(multiFixture.componentInstance.select.value).toBeFalsy();

            dispatchEvent(select, event);
            multiFixture.detectChanges();

            expect(multiFixture.componentInstance.select.value).toEqual(['pizza-1']);

            dispatchEvent(select, event);
            multiFixture.detectChanges();

            expect(multiFixture.componentInstance.select.value).toEqual(['pizza-1', 'tacos-2']);
          }));

        it('should toggle the previous option when pressing shift + UP_ARROW on a multi-select',
          fakeAsync(() => {
            fixture.destroy();

            const multiFixture = TestBed.createComponent(MultiSelect);
            const event = createKeyboardEvent('keydown', UP_ARROW, undefined, {shift: true});

            multiFixture.detectChanges();
            select = multiFixture.debugElement.query(By.css('mat-select'))!.nativeElement;

            multiFixture.componentInstance.select.open();
            multiFixture.detectChanges();
            flush();

            // Move focus down first.
            for (let i = 0; i < 5; i++) {
              dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
              multiFixture.detectChanges();
            }

            expect(multiFixture.componentInstance.select.value).toBeFalsy();

            dispatchEvent(select, event);
            multiFixture.detectChanges();

            expect(multiFixture.componentInstance.select.value).toEqual(['chips-4']);

            dispatchEvent(select, event);
            multiFixture.detectChanges();

            expect(multiFixture.componentInstance.select.value).toEqual(['sandwich-3', 'chips-4']);
          }));

        it('should prevent the default action when pressing space', fakeAsync(() => {
          const event = dispatchKeyboardEvent(select, 'keydown', SPACE);
          expect(event.defaultPrevented).toBe(true);
        }));

        it('should prevent the default action when pressing enter', fakeAsync(() => {
          const event = dispatchKeyboardEvent(select, 'keydown', ENTER);
          expect(event.defaultPrevented).toBe(true);
        }));

        it('should not prevent the default actions on selection keys when pressing a modifier',
          fakeAsync(() => {
            [ENTER, SPACE].forEach(key => {
              const event = createKeyboardEvent('keydown', key, undefined, {shift: true});
              expect(event.defaultPrevented).toBe(false);
            });

          }));

        it('should consider the selection a result of a user action when closed', fakeAsync(() => {
          const option = fixture.componentInstance.options.first;
          const spy = jasmine.createSpy('option selection spy');
          const subscription =
              option.onSelectionChange.pipe(map(e => e.isUserInput)).subscribe(spy);

          dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
          expect(spy).toHaveBeenCalledWith(true);

          subscription.unsubscribe();
          flush();
        }));

        it('should be able to focus the select trigger', fakeAsync(() => {
          document.body.focus(); // ensure that focus isn't on the trigger already

          fixture.componentInstance.select.focus();

          expect(document.activeElement)
            .withContext('Expected select element to be focused.').toBe(select);
        }));

        it('should set `aria-multiselectable` to true on the listbox inside multi select',
          fakeAsync(() => {
            fixture.destroy();

            const multiFixture = TestBed.createComponent(MultiSelect);
            multiFixture.detectChanges();
            select = multiFixture.debugElement.query(By.css('mat-select'))!.nativeElement;
            multiFixture.componentInstance.select.open();
            multiFixture.detectChanges();
            flush();

            const panel = document.querySelector('.mat-select-panel')!;
            expect(panel.getAttribute('aria-multiselectable')).toBe('true');
          }));

        it('should set aria-multiselectable false on single-selection instances', fakeAsync(() => {
          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          const panel = document.querySelector('.mat-select-panel')!;
          expect(panel.getAttribute('aria-multiselectable')).toBe('false');
        }));

        it('should set aria-activedescendant only while the panel is open', fakeAsync(() => {
          fixture.componentInstance.control.setValue('chips-4');
          fixture.detectChanges();

          const host = fixture.debugElement.query(By.css('mat-select'))!.nativeElement;

          expect(host.hasAttribute('aria-activedescendant'))
            .withContext('Expected no aria-activedescendant on init.').toBe(false);

          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          const options = overlayContainerElement.querySelectorAll('mat-option');

          expect(host.getAttribute('aria-activedescendant'))
            .withContext('Expected aria-activedescendant to match the active option.')
            .toBe(options[4].id);

          fixture.componentInstance.select.close();
          fixture.detectChanges();
          flush();

          expect(host.hasAttribute('aria-activedescendant'))
            .withContext('Expected no aria-activedescendant when closed.').toBe(false);
        }));

        it('should set aria-activedescendant based on the focused option', fakeAsync(() => {
          const host = fixture.debugElement.query(By.css('mat-select'))!.nativeElement;

          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          const options = overlayContainerElement.querySelectorAll('mat-option');

          expect(host.getAttribute('aria-activedescendant')).toBe(options[0].id);

          [1, 2, 3].forEach(() => {
            dispatchKeyboardEvent(host, 'keydown', DOWN_ARROW);
            fixture.detectChanges();
          });

          expect(host.getAttribute('aria-activedescendant')).toBe(options[4].id);

          dispatchKeyboardEvent(host, 'keydown', UP_ARROW);
          fixture.detectChanges();

          expect(host.getAttribute('aria-activedescendant')).toBe(options[3].id);
        }));

        it('should not change the aria-activedescendant using the horizontal arrow keys',
          fakeAsync(() => {
            const host = fixture.debugElement.query(By.css('mat-select'))!.nativeElement;

            fixture.componentInstance.select.open();
            fixture.detectChanges();
            flush();

            const options = overlayContainerElement.querySelectorAll('mat-option');

            expect(host.getAttribute('aria-activedescendant')).toBe(options[0].id);

            [1, 2, 3].forEach(() => {
              dispatchKeyboardEvent(host, 'keydown', RIGHT_ARROW);
              fixture.detectChanges();
            });

            expect(host.getAttribute('aria-activedescendant')).toBe(options[0].id);
          }));

        it('should restore focus to the trigger after selecting an option in multi-select mode',
          fakeAsync(() => {
            fixture.destroy();

            const multiFixture = TestBed.createComponent(MultiSelect);
            const instance = multiFixture.componentInstance;

            multiFixture.detectChanges();
            select = multiFixture.debugElement.query(By.css('mat-select'))!.nativeElement;
            instance.select.open();
            multiFixture.detectChanges();

            // Ensure that the select isn't focused to begin with.
            select.blur();
            expect(document.activeElement).not.toBe(select, 'Expected trigger not to be focused.');

            const option = overlayContainerElement.querySelector('mat-option')! as HTMLElement;
            option.click();
            multiFixture.detectChanges();

            expect(document.activeElement)
              .withContext('Expected trigger to be focused.').toBe(select);
          }));

        it('should set a role of listbox on the select panel', fakeAsync(() => {
          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          const panel = document.querySelector('.mat-select-panel')!;
          expect(panel.getAttribute('role')).toBe('listbox');
        }));

        it('should point the aria-labelledby of the panel to the field label', fakeAsync(() => {
          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          const labelId = fixture.nativeElement.querySelector('.mat-form-field-label').id;
          const panel = document.querySelector('.mat-select-panel')!;
          expect(panel.getAttribute('aria-labelledby')).toBe(labelId);
        }));

        it('should add a custom aria-labelledby to the panel', fakeAsync(() => {
          fixture.componentInstance.ariaLabelledby = 'myLabelId';
          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          const labelId = fixture.nativeElement.querySelector('.mat-form-field-label').id;
          const panel = document.querySelector('.mat-select-panel')!;
          expect(panel.getAttribute('aria-labelledby')).toBe(`${labelId} myLabelId`);
        }));

        it('should trim the custom panel aria-labelledby when there is no label', fakeAsync(() => {
          // Reset the `placeholder` which also controls the label of the form field.
          fixture.componentInstance.select.placeholder = '';
          fixture.componentInstance.ariaLabelledby = 'myLabelId';
          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          // Note that we assert that there are no spaces around the value.
          const panel = document.querySelector('.mat-select-panel')!;
          expect(panel.getAttribute('aria-labelledby')).toBe(`myLabelId`);
        }));

        it('should clear aria-labelledby from the panel if an aria-label is set', fakeAsync(() => {
          fixture.componentInstance.ariaLabel = 'My label';
          fixture.componentInstance.select.open();
          fixture.detectChanges();
          flush();

          const panel = document.querySelector('.mat-select-panel')!;
          expect(panel.getAttribute('aria-label')).toBe('My label');
          expect(panel.hasAttribute('aria-labelledby')).toBe(false);
        }));

      });

      describe('for options', () => {
        let fixture: ComponentFixture<BasicSelect>;
        let trigger: HTMLElement;
        let options: HTMLElement[];

        beforeEach(fakeAsync(() => {
          fixture = TestBed.createComponent(BasicSelect);
          fixture.detectChanges();
          trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
          trigger.click();
          fixture.detectChanges();

          options = Array.from(overlayContainerElement.querySelectorAll('mat-option'));
        }));

        it('should set the role of mat-option to option', fakeAsync(() => {
          expect(options[0].getAttribute('role')).toEqual('option');
          expect(options[1].getAttribute('role')).toEqual('option');
          expect(options[2].getAttribute('role')).toEqual('option');
        }));

        it('should set aria-selected on each option for single select',  fakeAsync(() => {
          expect(options.every(option => !option.hasAttribute('aria-selected')))
            .withContext('Expected all unselected single-select options not to have ' +
                         'aria-selected set.').toBe(true);

          options[1].click();
          fixture.detectChanges();

          trigger.click();
          fixture.detectChanges();
          flush();

          expect(options[1].getAttribute('aria-selected'))
            .withContext('Expected selected single-select option to have aria-selected="true".')
            .toEqual('true');
          options.splice(1, 1);
          expect(options.every(option => !option.hasAttribute('aria-selected')))
            .withContext('Expected all unselected single-select options not to have ' +
                         'aria-selected set.').toBe(true);
        }));

        it('should set aria-selected on each option for multi-select', fakeAsync(() => {
          fixture.destroy();

          const multiFixture = TestBed.createComponent(MultiSelect);
          multiFixture.detectChanges();

          trigger = multiFixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
          trigger.click();
          multiFixture.detectChanges();

          options = Array.from(overlayContainerElement.querySelectorAll('mat-option'));

          expect(options.every(option => option.hasAttribute('aria-selected') &&
          option.getAttribute('aria-selected') === 'false'))
            .withContext('Expected all unselected multi-select options to have ' +
                         'aria-selected="false".').toBe(true);

          options[1].click();
          multiFixture.detectChanges();

          trigger.click();
          multiFixture.detectChanges();
          flush();

          expect(options[1].getAttribute('aria-selected'))
            .withContext('Expected selected multi-select option to have ' +
                         'aria-selected="true".').toEqual('true');
          options.splice(1, 1);
          expect(options.every(option => option.hasAttribute('aria-selected') &&
          option.getAttribute('aria-selected') === 'false'))
            .withContext('Expected all unselected multi-select options to have ' +
                         'aria-selected="false".').toBe(true);
          }));

        it('should set the tabindex of each option according to disabled state', fakeAsync(() => {
          expect(options[0].getAttribute('tabindex')).toEqual('0');
          expect(options[1].getAttribute('tabindex')).toEqual('0');
          expect(options[2].getAttribute('tabindex')).toEqual('-1');
        }));

        it('should set aria-disabled for disabled options', fakeAsync(() => {
          expect(options[0].getAttribute('aria-disabled')).toEqual('false');
          expect(options[1].getAttribute('aria-disabled')).toEqual('false');
          expect(options[2].getAttribute('aria-disabled')).toEqual('true');

          fixture.componentInstance.foods[2]['disabled'] = false;
          fixture.detectChanges();

          expect(options[0].getAttribute('aria-disabled')).toEqual('false');
          expect(options[1].getAttribute('aria-disabled')).toEqual('false');
          expect(options[2].getAttribute('aria-disabled')).toEqual('false');
        }));

        it('should remove the active state from options that have been deselected while closed',
          fakeAsync(() => {
            let activeOptions = options.filter(option => option.classList.contains('mat-active'));
            expect(activeOptions)
              .withContext('Expected first option to have active styles.').toEqual([options[0]]);

            options[1].click();
            fixture.detectChanges();
            fixture.componentInstance.select.open();
            fixture.detectChanges();
            flush();

            activeOptions = options.filter(option => option.classList.contains('mat-active'));
            expect(activeOptions)
              .withContext('Expected only selected option to be marked as active after ' +
                           'it is clicked.').toEqual([options[1]]);

            fixture.componentInstance.control.setValue(fixture.componentInstance.foods[7].value);
            fixture.detectChanges();
            fixture.componentInstance.select.close();
            fixture.detectChanges();
            flush();

            fixture.componentInstance.select.open();
            fixture.detectChanges();

            activeOptions = options.filter(option => option.classList.contains('mat-active'));
            expect(activeOptions)
              .withContext('Expected only selected option to be marked as active after the ' +
                           'value has changed.').toEqual([options[7]]);
          }));
      });

      describe('for option groups', () => {
        let fixture: ComponentFixture<SelectWithGroups>;
        let trigger: HTMLElement;
        let groups: NodeListOf<HTMLElement>;

        beforeEach(fakeAsync(() => {
          fixture = TestBed.createComponent(SelectWithGroups);
          fixture.detectChanges();
          trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
          trigger.click();
          fixture.detectChanges();
          groups =
              overlayContainerElement.querySelectorAll('mat-optgroup') as NodeListOf<HTMLElement>;
        }));

        it('should set the appropriate role', fakeAsync(() => {
          expect(groups[0].getAttribute('role')).toBe('group');
        }));

        it('should set the `aria-labelledby` attribute', fakeAsync(() => {
          const group = groups[0];
          const label = group.querySelector('span')!;

          expect(label.getAttribute('id'))
            .withContext('Expected label to have an id.')
            .toBeTruthy();
          expect(group.getAttribute('aria-labelledby'))
            .withContext('Expected `aria-labelledby` to match the label id.')
            .toBe(label.getAttribute('id'));
        }));

        it('should set the `aria-disabled` attribute if the group is disabled', fakeAsync(() => {
          expect(groups[1].getAttribute('aria-disabled')).toBe('true');
        }));
      });
    });

    describe('overlay panel', () => {
      let fixture: ComponentFixture<BasicSelect>;
      let trigger: HTMLElement;

      beforeEach(fakeAsync(() => {
        fixture = TestBed.createComponent(BasicSelect);
        fixture.detectChanges();
        trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
      }));

      it('should not throw when attempting to open too early', () => {
        // Create component and then immediately open without running change detection
        fixture = TestBed.createComponent(BasicSelect);
        expect(() => fixture.componentInstance.select.open()).not.toThrow();
      });

      it('should open the panel when trigger is clicked', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.select.panelOpen).toBe(true);
        expect(overlayContainerElement.textContent).toContain('Steak');
        expect(overlayContainerElement.textContent).toContain('Pizza');
        expect(overlayContainerElement.textContent).toContain('Tacos');
      }));

      it('should close the panel when an item is clicked', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        const option = overlayContainerElement.querySelector('mat-option') as HTMLElement;
        option.click();
        fixture.detectChanges();
        flush();

        expect(overlayContainerElement.textContent).toEqual('');
        expect(fixture.componentInstance.select.panelOpen).toBe(false);
      }));

      it('should close the panel when a click occurs outside the panel', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        const backdrop =
            overlayContainerElement.querySelector('.cdk-overlay-backdrop') as HTMLElement;

        backdrop.click();
        fixture.detectChanges();
        flush();

        expect(overlayContainerElement.textContent).toEqual('');
        expect(fixture.componentInstance.select.panelOpen).toBe(false);
      }));

      it('should set the width of the overlay based on the trigger', fakeAsync(() => {
        trigger.style.width = '200px';

        trigger.click();
        fixture.detectChanges();
        flush();

        const pane = overlayContainerElement.querySelector('.cdk-overlay-pane') as HTMLElement;
        expect(pane.style.minWidth).toBe('200px');

        const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel');
        const scrollContainerWidth = scrollContainer!.getBoundingClientRect().width;
        expect(scrollContainerWidth).toBeCloseTo(200 + 32, 0,
            'Expected select panel width to be 100% + 32px of the select field trigger');
      }));

      it('should set the width of the overlay based on a larger trigger width',
        fakeAsync(() => {
            // the trigger width exceeds the minimum width of the mat-select-panel
          trigger.style.width = '400px';

          trigger.click();
          fixture.detectChanges();
          flush();

          const pane = overlayContainerElement.querySelector('.cdk-overlay-pane') as HTMLElement;
          expect(pane.style.minWidth).toBe('400px');

          const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel');
          const scrollContainerWidth = scrollContainer!.getBoundingClientRect().width;
          expect(scrollContainerWidth).toBeCloseTo(400 + 32, 0,
              'Expected select panel width to be 100% + 32px of the select field trigger');
      }));

      it('should update the width of the panel on resize', fakeAsync(() => {
        trigger.style.width = '300px';

        trigger.click();
        fixture.detectChanges();
        flush();

        const pane = overlayContainerElement.querySelector('.cdk-overlay-pane') as HTMLElement;
        const initialWidth = parseInt(pane.style.minWidth || '0');

        expect(initialWidth).toBeGreaterThan(0);

        trigger.style.width = '400px';
        dispatchFakeEvent(window, 'resize');
        fixture.detectChanges();
        tick(1000);
        fixture.detectChanges();

        expect(parseInt(pane.style.minWidth || '0')).toBeGreaterThan(initialWidth);
      }));

      it('should not attempt to open a select that does not have any options', fakeAsync(() => {
        fixture.componentInstance.foods = [];
        fixture.detectChanges();

        trigger.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.select.panelOpen).toBe(false);
      }));

      it('should close the panel when tabbing out', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.select.panelOpen).toBe(true);

        dispatchKeyboardEvent(trigger, 'keydown', TAB);
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.select.panelOpen).toBe(false);
      }));

      it('should restore focus to the host before tabbing away', fakeAsync(() => {
        const select = fixture.nativeElement.querySelector('.mat-select');

        trigger.click();
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.select.panelOpen).toBe(true);

        // Use a spy since focus can be flaky in unit tests.
        spyOn(select, 'focus').and.callThrough();

        dispatchKeyboardEvent(trigger, 'keydown', TAB);
        fixture.detectChanges();
        flush();

        expect(select.focus).toHaveBeenCalled();
      }));

      it('should close when tabbing out from inside the panel', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.select.panelOpen).toBe(true);

        const panel = overlayContainerElement.querySelector('.mat-select-panel')!;
        dispatchKeyboardEvent(panel, 'keydown', TAB);
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.select.panelOpen).toBe(false);
      }));

      it('should focus the first option when pressing HOME', fakeAsync(() => {
        fixture.componentInstance.control.setValue('pizza-1');
        fixture.detectChanges();

        trigger.click();
        fixture.detectChanges();
        flush();

        const event = dispatchKeyboardEvent(trigger, 'keydown', HOME);
        fixture.detectChanges();

        expect(fixture.componentInstance.select._keyManager.activeItemIndex).toBe(0);
        expect(event.defaultPrevented).toBe(true);
      }));

      it('should focus the last option when pressing END', fakeAsync(() => {
        fixture.componentInstance.control.setValue('pizza-1');
        fixture.detectChanges();

        trigger.click();
        fixture.detectChanges();
        flush();

        const event = dispatchKeyboardEvent(trigger, 'keydown', END);
        fixture.detectChanges();

        expect(fixture.componentInstance.select._keyManager.activeItemIndex).toBe(7);
        expect(event.defaultPrevented).toBe(true);
      }));

      it('should be able to set extra classes on the panel', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();

        const panel = overlayContainerElement.querySelector('.mat-select-panel') as HTMLElement;

        expect(panel.classList).toContain('custom-one');
        expect(panel.classList).toContain('custom-two');
      }));

      it('should update disableRipple properly on each option', fakeAsync(() => {
        const options = fixture.componentInstance.options.toArray();

        expect(options.every(option => option.disableRipple === false))
          .withContext('Expected all options to have disableRipple set to false initially.')
          .toBeTruthy();

        fixture.componentInstance.disableRipple = true;
        fixture.detectChanges();

        expect(options.every(option => option.disableRipple === true))
          .withContext('Expected all options to have disableRipple set to true.')
          .toBeTruthy();
      }));

      it('should not show ripples if they were disabled', fakeAsync(() => {
        fixture.componentInstance.disableRipple = true;
        fixture.detectChanges();

        trigger.click();
        fixture.detectChanges();
        flush();

        const option = overlayContainerElement.querySelector('mat-option')!;

        dispatchFakeEvent(option, 'mousedown');
        dispatchFakeEvent(option, 'mouseup');

        expect(option.querySelectorAll('.mat-ripple-element').length).toBe(0);
      }));

      it('should be able to render options inside groups with an ng-container', fakeAsync(() => {
        fixture.destroy();

        const groupFixture = TestBed.createComponent(SelectWithGroupsAndNgContainer);
        groupFixture.detectChanges();
        trigger = groupFixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
        trigger.click();
        groupFixture.detectChanges();

        expect(document.querySelectorAll('.cdk-overlay-container mat-option').length)
          .withContext('Expected at least one option to be rendered.').toBeGreaterThan(0);
      }));

      it('should not consider itself as blurred if the trigger loses focus while the ' +
        'panel is still open', fakeAsync(() => {
          const selectElement = fixture.nativeElement.querySelector('.mat-select');
          const selectInstance = fixture.componentInstance.select;

          dispatchFakeEvent(selectElement, 'focus');
          fixture.detectChanges();

          expect(selectInstance.focused)
            .withContext('Expected select to be focused.').toBe(true);

          selectInstance.open();
          fixture.detectChanges();
          flush();
          dispatchFakeEvent(selectElement, 'blur');
          fixture.detectChanges();

          expect(selectInstance.focused)
            .withContext('Expected select element to remain focused.').toBe(true);
        }));

    });

    describe('selection logic', () => {
      let fixture: ComponentFixture<BasicSelect>;
      let trigger: HTMLElement;
      let formField: HTMLElement;

      beforeEach(fakeAsync(() => {
        fixture = TestBed.createComponent(BasicSelect);
        fixture.detectChanges();
        trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
        formField = fixture.debugElement.query(By.css('.mat-form-field'))!.nativeElement;
      }));

      it('should not float label if no option is selected', fakeAsync(() => {
        expect(formField.classList.contains('mat-form-field-should-float'))
          .withContext('Label should not be floating').toBe(false);
      }));

      it('should focus the first option if no option is selected', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.select._keyManager.activeItemIndex).toEqual(0);
      }));

      it('should select an option when it is clicked', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        let option = overlayContainerElement.querySelector('mat-option') as HTMLElement;
        option.click();
        fixture.detectChanges();
        flush();

        trigger.click();
        fixture.detectChanges();
        flush();

        option = overlayContainerElement.querySelector('mat-option') as HTMLElement;

        expect(option.classList).toContain('mat-selected');
        expect(fixture.componentInstance.options.first.selected).toBe(true);
        expect(fixture.componentInstance.select.selected)
            .toBe(fixture.componentInstance.options.first);
      }));

      it('should be able to select an option using the MatOption API', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        const optionInstances = fixture.componentInstance.options.toArray();
        const optionNodes: NodeListOf<HTMLElement> =
            overlayContainerElement.querySelectorAll('mat-option');

        optionInstances[1].select();
        fixture.detectChanges();

        expect(optionNodes[1].classList).toContain('mat-selected');
        expect(optionInstances[1].selected).toBe(true);
        expect(fixture.componentInstance.select.selected).toBe(optionInstances[1]);
      }));

      it('should deselect other options when one is selected', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        let options =
            overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;

        options[0].click();
        fixture.detectChanges();
        flush();

        trigger.click();
        fixture.detectChanges();
        flush();

        options =
            overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;
        expect(options[1].classList).not.toContain('mat-selected');
        expect(options[2].classList).not.toContain('mat-selected');

        const optionInstances = fixture.componentInstance.options.toArray();
        expect(optionInstances[1].selected).toBe(false);
        expect(optionInstances[2].selected).toBe(false);
      }));

      it('should deselect other options when one is programmatically selected', fakeAsync(() => {
        const control = fixture.componentInstance.control;
        const foods = fixture.componentInstance.foods;

        trigger.click();
        fixture.detectChanges();
        flush();

        let options =
            overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;

        options[0].click();
        fixture.detectChanges();
        flush();

        control.setValue(foods[1].value);
        fixture.detectChanges();

        trigger.click();
        fixture.detectChanges();
        flush();

        options = overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;

        expect(options[0].classList)
            .not.toContain('mat-selected', 'Expected first option to no longer be selected');
        expect(options[1].classList)
          .withContext('Expected second option to be selected').toContain('mat-selected');

        const optionInstances = fixture.componentInstance.options.toArray();

        expect(optionInstances[0].selected)
          .withContext('Expected first option to no longer be selected').toBe(false);
        expect(optionInstances[1].selected)
          .withContext('Expected second option to be selected').toBe(true);
      }));

      it('should remove selection if option has been removed', fakeAsync(() => {
        const select = fixture.componentInstance.select;

        trigger.click();
        fixture.detectChanges();
        flush();

        const firstOption =
            overlayContainerElement.querySelectorAll('mat-option')[0] as HTMLElement;

        firstOption.click();
        fixture.detectChanges();

        expect(select.selected)
          .withContext('Expected first option to be selected.').toBe(select.options.first);

        fixture.componentInstance.foods = [];
        fixture.detectChanges();
        flush();

        expect(select.selected)
          .withContext('Expected selection to be removed when option no longer exists.')
          .toBeUndefined();
      }));

      it('should display the selected option in the trigger', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        const option = overlayContainerElement.querySelector('mat-option') as HTMLElement;
        option.click();
        fixture.detectChanges();
        flush();

        const value = fixture.debugElement.query(By.css('.mat-select-value'))!.nativeElement;

        expect(formField.classList.contains('mat-form-field-should-float'))
          .withContext('Label should be floating').toBe(true);
        expect(value.textContent).toContain('Steak');
      }));

      it('should focus the selected option if an option is selected', fakeAsync(() => {
        // must wait for initial writeValue promise to finish
        flush();

        fixture.componentInstance.control.setValue('pizza-1');
        fixture.detectChanges();

        trigger.click();
        fixture.detectChanges();
        flush();

        // must wait for animation to finish
        fixture.detectChanges();
        expect(fixture.componentInstance.select._keyManager.activeItemIndex).toEqual(1);
      }));

      it('should select an option that was added after initialization', fakeAsync(() => {
        fixture.componentInstance.foods.push({viewValue: 'Potatoes', value: 'potatoes-8'});
        trigger.click();
        fixture.detectChanges();
        flush();

        const options =
            overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;
        options[8].click();
        fixture.detectChanges();
        flush();

        expect(trigger.textContent).toContain('Potatoes');
        expect(fixture.componentInstance.select.selected)
            .toBe(fixture.componentInstance.options.last);
      }));

      it('should update the trigger when the selected option label is changed', fakeAsync(() => {
        fixture.componentInstance.control.setValue('pizza-1');
        fixture.detectChanges();

        expect(trigger.textContent!.trim()).toBe('Pizza');

        fixture.componentInstance.foods[1].viewValue = 'Calzone';
        fixture.detectChanges();

        expect(trigger.textContent!.trim()).toBe('Calzone');
      }));

      it('should not select disabled options', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();

        const options =
            overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;
        options[2].click();
        fixture.detectChanges();

        expect(fixture.componentInstance.select.panelOpen).toBe(true);
        expect(options[2].classList).not.toContain('mat-selected');
        expect(fixture.componentInstance.select.selected).toBeUndefined();
      }));

      it('should not select options inside a disabled group', fakeAsync(() => {
        fixture.destroy();

        const groupFixture = TestBed.createComponent(SelectWithGroups);
        groupFixture.detectChanges();
        groupFixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement.click();
        groupFixture.detectChanges();

        const disabledGroup = overlayContainerElement.querySelectorAll('mat-optgroup')[1];
        const options = disabledGroup.querySelectorAll('mat-option');

        (options[0] as HTMLElement).click();
        groupFixture.detectChanges();

        expect(groupFixture.componentInstance.select.panelOpen).toBe(true);
        expect(options[0].classList).not.toContain('mat-selected');
        expect(groupFixture.componentInstance.select.selected).toBeUndefined();
      }));

      it('should not throw if triggerValue accessed with no selected value', fakeAsync(() => {
        expect(() => fixture.componentInstance.select.triggerValue).not.toThrow();
      }));

      it('should emit to `optionSelectionChanges` when an option is selected', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        const spy = jasmine.createSpy('option selection spy');
        const subscription = fixture.componentInstance.select.optionSelectionChanges.subscribe(spy);
        const option = overlayContainerElement.querySelector('mat-option') as HTMLElement;
        option.click();
        fixture.detectChanges();
        flush();

        expect(spy).toHaveBeenCalledWith(jasmine.any(MatOptionSelectionChange));

        subscription.unsubscribe();
      }));

      it('should handle accessing `optionSelectionChanges` before the options are initialized',
        fakeAsync(() => {
          fixture.destroy();
          fixture = TestBed.createComponent(BasicSelect);

          const spy = jasmine.createSpy('option selection spy');
          let subscription: Subscription;

          expect(fixture.componentInstance.select.options).toBeFalsy();
          expect(() => {
            subscription = fixture.componentInstance.select.optionSelectionChanges.subscribe(spy);
          }).not.toThrow();

          fixture.detectChanges();
          trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;

          trigger.click();
          fixture.detectChanges();
          flush();

          const option = overlayContainerElement.querySelector('mat-option') as HTMLElement;
          option.click();
          fixture.detectChanges();
          flush();

          expect(spy).toHaveBeenCalledWith(jasmine.any(MatOptionSelectionChange));

          subscription!.unsubscribe();
        }));

      it('should emit to `optionSelectionChanges` after the list of options has changed',
        fakeAsync(() => {
          const spy = jasmine.createSpy('option selection spy');
          const subscription =
              fixture.componentInstance.select.optionSelectionChanges.subscribe(spy);
          const selectFirstOption = () => {
            trigger.click();
            fixture.detectChanges();
            flush();

            const option = overlayContainerElement.querySelector('mat-option') as HTMLElement;
            option.click();
            fixture.detectChanges();
            flush();
          };

          fixture.componentInstance.foods = [{value: 'salad-8', viewValue: 'Salad'}];
          fixture.detectChanges();
          selectFirstOption();

          expect(spy).toHaveBeenCalledTimes(1);

          fixture.componentInstance.foods = [{value: 'fruit-9', viewValue: 'Fruit'}];
          fixture.detectChanges();
          selectFirstOption();

          expect(spy).toHaveBeenCalledTimes(2);

          subscription!.unsubscribe();
        }));

        it('should not indicate programmatic value changes as user interactions', () => {
          const events: MatOptionSelectionChange[] = [];
          const subscription = fixture.componentInstance.select.optionSelectionChanges
            .subscribe((event: MatOptionSelectionChange) => events.push(event));

          fixture.componentInstance.control.setValue('eggs-5');
          fixture.detectChanges();

          expect(events.map(event => event.isUserInput)).toEqual([false]);

          subscription.unsubscribe();
        });

    });

    describe('forms integration', () => {
      let fixture: ComponentFixture<BasicSelect>;
      let trigger: HTMLElement;

      beforeEach(fakeAsync(() => {
        fixture = TestBed.createComponent(BasicSelect);
        fixture.detectChanges();
        trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
      }));

      it('should take an initial view value with reactive forms', fakeAsync(() => {
        fixture.componentInstance.control = new FormControl('pizza-1');
        fixture.detectChanges();

        const value = fixture.debugElement.query(By.css('.mat-select-value'))!;
        expect(value.nativeElement.textContent)
          .withContext(`Expected trigger to be populated by the control's initial value.`)
          .toContain('Pizza');

        trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
        trigger.click();
        fixture.detectChanges();
        flush();

        const options =
            overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;
        expect(options[1].classList)
          .withContext(`Expected option with the control's initial value to be selected.`)
          .toContain('mat-selected');
      }));

      it('should set the view value from the form', fakeAsync(() => {
        let value = fixture.debugElement.query(By.css('.mat-select-value'))!;
        expect(value.nativeElement.textContent.trim()).toBe('Food');

        fixture.componentInstance.control.setValue('pizza-1');
        fixture.detectChanges();

        value = fixture.debugElement.query(By.css('.mat-select-value'))!;
        expect(value.nativeElement.textContent)
          .withContext(`Expected trigger to be populated by the control's new value.`)
          .toContain('Pizza');

        trigger.click();
        fixture.detectChanges();
        flush();

        const options =
            overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;
        expect(options[1].classList)
          .withContext(`Expected option with the control's new value to be selected.`)
          .toContain('mat-selected');
      }));

      it('should update the form value when the view changes', fakeAsync(() => {
        expect(fixture.componentInstance.control.value)
          .withContext(`Expected the control's value to be empty initially.`).toEqual(null);

        trigger.click();
        fixture.detectChanges();
        flush();

        const option = overlayContainerElement.querySelector('mat-option') as HTMLElement;
        option.click();
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.control.value)
          .withContext(`Expected control's value to be set to the new option.`).toEqual('steak-0');
      }));

      it('should clear the selection when a nonexistent option value is selected', fakeAsync(() => {
        fixture.componentInstance.control.setValue('pizza-1');
        fixture.detectChanges();

        fixture.componentInstance.control.setValue('gibberish');
        fixture.detectChanges();

        const value = fixture.debugElement.query(By.css('.mat-select-value'))!;
        expect(value.nativeElement.textContent.trim())
          .withContext(`Expected trigger to show the placeholder.`).toBe('Food');
        expect(trigger.textContent)
            .not.toContain('Pizza', `Expected trigger is cleared when option value is not found.`);

        trigger.click();
        fixture.detectChanges();
        flush();

        const options =
            overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;
        expect(options[1].classList)
            .not.toContain('mat-selected', `Expected option w/ the old value not to be selected.`);
      }));


      it('should clear the selection when the control is reset', fakeAsync(() => {
        fixture.componentInstance.control.setValue('pizza-1');
        fixture.detectChanges();

        fixture.componentInstance.control.reset();
        fixture.detectChanges();

        const value = fixture.debugElement.query(By.css('.mat-select-value'))!;
        expect(value.nativeElement.textContent.trim())
          .withContext(`Expected trigger to show the placeholder.`).toBe('Food');
        expect(trigger.textContent)
            .not.toContain('Pizza', `Expected trigger is cleared when option value is not found.`);

        trigger.click();
        fixture.detectChanges();
        flush();

        const options =
            overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;
        expect(options[1].classList)
            .not.toContain('mat-selected', `Expected option w/ the old value not to be selected.`);
      }));

      it('should set the control to touched when the select is blurred', fakeAsync(() => {
        expect(fixture.componentInstance.control.touched)
          .withContext(`Expected the control to start off as untouched.`).toEqual(false);

        trigger.click();
        dispatchFakeEvent(trigger, 'blur');
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.control.touched)
          .withContext(`Expected the control to stay untouched when menu opened.`).toEqual(false);

        const backdrop =
            overlayContainerElement.querySelector('.cdk-overlay-backdrop') as HTMLElement;
        backdrop.click();
        dispatchFakeEvent(trigger, 'blur');
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.control.touched)
          .withContext(`Expected the control to be touched as soon as focus left the select.`)
          .toEqual(true);
      }));

      it('should set the control to touched when the panel is closed', fakeAsync(() => {
        expect(fixture.componentInstance.control.touched)
          .withContext('Expected the control to start off as untouched.').toBe(false);

        trigger.click();
        dispatchFakeEvent(trigger, 'blur');
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.control.touched)
          .withContext('Expected the control to stay untouched when menu opened.').toBe(false);

        fixture.componentInstance.select.close();
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.control.touched)
          .withContext('Expected the control to be touched when the panel was closed.').toBe(true);
      }));

      it('should not set touched when a disabled select is touched', fakeAsync(() => {
        expect(fixture.componentInstance.control.touched)
          .withContext('Expected the control to start off as untouched.').toBe(false);

        fixture.componentInstance.control.disable();
        dispatchFakeEvent(trigger, 'blur');

        expect(fixture.componentInstance.control.touched)
          .withContext('Expected the control to stay untouched.').toBe(false);
      }));

      it('should set the control to dirty when the select value changes in DOM', fakeAsync(() => {
        expect(fixture.componentInstance.control.dirty)
          .withContext(`Expected control to start out pristine.`).toEqual(false);

        trigger.click();
        fixture.detectChanges();
        flush();

        const option = overlayContainerElement.querySelector('mat-option') as HTMLElement;
        option.click();
        fixture.detectChanges();
        flush();

        expect(fixture.componentInstance.control.dirty)
          .withContext(`Expected control to be dirty after value was changed by user.`)
          .toEqual(true);
      }));

      it('should not set the control to dirty when the value changes programmatically',
          fakeAsync(() => {
            expect(fixture.componentInstance.control.dirty)
              .withContext(`Expected control to start out pristine.`).toEqual(false);

            fixture.componentInstance.control.setValue('pizza-1');

            expect(fixture.componentInstance.control.dirty)
              .withContext(`Expected control to stay pristine after programmatic change.`)
              .toEqual(false);
          }));

      it('should set an asterisk after the label if control is required', fakeAsync(() => {
        let requiredMarker = fixture.debugElement.query(By.css('.mat-form-field-required-marker'));
        expect(requiredMarker)
          .withContext(`Expected label not to have an asterisk, as control was not required.`)
          .toBeNull();

        fixture.componentInstance.isRequired = true;
        fixture.detectChanges();

        requiredMarker = fixture.debugElement.query(By.css('.mat-form-field-required-marker'));
        expect(requiredMarker).not
          .withContext(`Expected label to have an asterisk, as control was required.`)
          .toBeNull();
      }));
    });

    describe('disabled behavior', () => {
      it('should disable itself when control is disabled programmatically', fakeAsync(() => {
        const fixture = TestBed.createComponent(BasicSelect);
        fixture.detectChanges();

        fixture.componentInstance.control.disable();
        fixture.detectChanges();
        const trigger =
            fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
        expect(getComputedStyle(trigger).getPropertyValue('cursor'))
          .withContext(`Expected cursor to be default arrow on disabled control.`)
          .toEqual('default');

        trigger.click();
        fixture.detectChanges();

        expect(overlayContainerElement.textContent)
          .withContext(`Expected select panel to stay closed.`).toEqual('');
        expect(fixture.componentInstance.select.panelOpen)
          .withContext(`Expected select panelOpen property to stay false.`).toBe(false);

        fixture.componentInstance.control.enable();
        fixture.detectChanges();
        expect(getComputedStyle(trigger).getPropertyValue('cursor'))
          .withContext(`Expected cursor to be a pointer on enabled control.`).toEqual('pointer');

        trigger.click();
        fixture.detectChanges();

        expect(overlayContainerElement.textContent)
          .withContext(`Expected select panel to open normally on re-enabled control`)
          .toContain('Steak');
        expect(fixture.componentInstance.select.panelOpen)
          .withContext(`Expected select panelOpen property to become true.`).toBe(true);
      }));
    });

    describe('animations', () => {
      let fixture: ComponentFixture<BasicSelect>;
      let formField: HTMLElement;

      beforeEach(fakeAsync(() => {
        fixture = TestBed.createComponent(BasicSelect);
        fixture.detectChanges();
        formField = fixture.debugElement.query(By.css('.mat-form-field'))!.nativeElement;
      }));

      it('should float the label when the panel is open and unselected', fakeAsync(() => {
        expect(formField.classList.contains('mat-form-field-should-float'))
          .withContext('Expected label to initially have a normal position.').toBe(false);

        fixture.componentInstance.select.open();
        fixture.detectChanges();
        flush();

        expect(formField.classList)
          .withContext('Expected label to animate up to floating position.')
          .toContain('mat-form-field-should-float');

        fixture.componentInstance.select.close();
        fixture.detectChanges();
        flush();

        expect(formField.classList).not
          .withContext('Expected placeholder to animate back down to normal position.')
          .toContain('mat-form-field-should-float');
      }));

    });

    describe('keyboard scrolling', () => {
      let fixture: ComponentFixture<BasicSelect>;
      let host: HTMLElement;
      let panel: HTMLElement;

      beforeEach(fakeAsync(() => {
        fixture = TestBed.createComponent(BasicSelect);

        fixture.componentInstance.foods = [];

        for (let i = 0; i < 30; i++) {
          fixture.componentInstance.foods.push({value: `value-${i}`, viewValue: `Option ${i}`});
        }

        fixture.detectChanges();
        fixture.componentInstance.select.open();
        fixture.detectChanges();
        flush();
        fixture.detectChanges();

        host = fixture.debugElement.query(By.css('mat-select'))!.nativeElement;
        panel = overlayContainerElement.querySelector('.mat-select-panel')! as HTMLElement;
      }));

      it('should not scroll to options that are completely in the view', fakeAsync(() => {
        const initialScrollPosition = panel.scrollTop;

        [1, 2, 3].forEach(() => {
          dispatchKeyboardEvent(host, 'keydown', DOWN_ARROW);
        });

        expect(panel.scrollTop)
          .withContext('Expected scroll position not to change').toBe(initialScrollPosition);
      }));

      it('should scroll down to the active option', fakeAsync(() => {
        for (let i = 0; i < 15; i++) {
          dispatchKeyboardEvent(host, 'keydown', DOWN_ARROW);
        }

        // <option index * height> - <panel height> = 16 * 48 - 256 = 512
        // <option index * height> - <panel height> = 16 * 48 - 256 = 512
        expect(panel.scrollTop)
          .withContext('Expected scroll to be at the 16th option.').toBe(512);
      }));

      it('should scroll up to the active option', fakeAsync(() => {
        // Scroll to the bottom.
        for (let i = 0; i < fixture.componentInstance.foods.length; i++) {
          dispatchKeyboardEvent(host, 'keydown', DOWN_ARROW);
        }

        for (let i = 0; i < 20; i++) {
          dispatchKeyboardEvent(host, 'keydown', UP_ARROW);
        }

        // <option index * height> = 9 * 48 = 432
        // <option index * height> = 9 * 48 = 432
        expect(panel.scrollTop)
          .withContext('Expected scroll to be at the 9th option.').toBe(432);
      }));

      it('should skip option group labels', fakeAsync(() => {
        fixture.destroy();

        const groupFixture = TestBed.createComponent(SelectWithGroups);

        groupFixture.detectChanges();
        groupFixture.componentInstance.select.open();
        groupFixture.detectChanges();
        flush();

        host = groupFixture.debugElement.query(By.css('mat-select'))!.nativeElement;
        panel = overlayContainerElement.querySelector('.mat-select-panel')! as HTMLElement;

        for (let i = 0; i < 5; i++) {
          dispatchKeyboardEvent(host, 'keydown', DOWN_ARROW);
        }

        // Note that we press down 5 times, but it will skip
        // 3 options because the second group is disabled.
        // <(option index + group labels) * height> - <panel height> = (9 + 3) * 48 - 256 = 320
        // Note that we press down 5 times, but it will skip
        // 3 options because the second group is disabled.
        // <(option index + group labels) * height> - <panel height> = (9 + 3) * 48 - 256 = 320
        expect(panel.scrollTop)
          .withContext('Expected scroll to be at the 9th option.').toBe(320);
      }));

      it('should scroll to the top when pressing HOME', fakeAsync(() => {
        for (let i = 0; i < 20; i++) {
          dispatchKeyboardEvent(host, 'keydown', DOWN_ARROW);
          fixture.detectChanges();
        }

        expect(panel.scrollTop)
          .withContext('Expected panel to be scrolled down.').toBeGreaterThan(0);

        dispatchKeyboardEvent(host, 'keydown', HOME);
        fixture.detectChanges();

        expect(panel.scrollTop)
          .withContext('Expected panel to be scrolled to the top').toBe(0);
      }));

      it('should scroll to the bottom of the panel when pressing END', fakeAsync(() => {
        dispatchKeyboardEvent(host, 'keydown', END);
        fixture.detectChanges();

        // <option amount> * <option height> - <panel height> = 30 * 48 - 256 = 1184
        // <option amount> * <option height> - <panel height> = 30 * 48 - 256 = 1184
        expect(panel.scrollTop)
          .withContext('Expected panel to be scrolled to the bottom').toBe(1184);
      }));

      it('should scroll to the active option when typing', fakeAsync(() => {
        for (let i = 0; i < 15; i++) {
          // Press the letter 'o' 15 times since all the options are named 'Option <index>'
          dispatchEvent(host, createKeyboardEvent('keydown', 79, 'o'));
          fixture.detectChanges();
          tick(DEFAULT_TYPEAHEAD_DEBOUNCE_INTERVAL);
        }
        flush();

        // <option index * height> - <panel height> = 16 * 48 - 256 = 512
        // <option index * height> - <panel height> = 16 * 48 - 256 = 512
        expect(panel.scrollTop)
          .withContext('Expected scroll to be at the 16th option.').toBe(512);
      }));

      it('should scroll to top when going to first option in top group', fakeAsync(() => {
        fixture.destroy();
        const groupFixture = TestBed.createComponent(SelectWithGroups);
        groupFixture.detectChanges();
        groupFixture.componentInstance.select.open();
        groupFixture.detectChanges();
        flush();

        host = groupFixture.debugElement.query(By.css('mat-select'))!.nativeElement;
        panel = overlayContainerElement.querySelector('.mat-select-panel')! as HTMLElement;

        for (let i = 0; i < 5; i++) {
          dispatchKeyboardEvent(host, 'keydown', DOWN_ARROW);
        }

        expect(panel.scrollTop).toBeGreaterThan(0);

        for (let i = 0; i < 5; i++) {
          dispatchKeyboardEvent(host, 'keydown', UP_ARROW);
        }

        expect(panel.scrollTop).toBe(0);
      }));

    });
  });

  describe('when initialized without options', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([SelectInitWithoutOptions])));

    it('should select the proper option when option list is initialized later', fakeAsync(() => {
      const fixture = TestBed.createComponent(SelectInitWithoutOptions);
      const instance = fixture.componentInstance;

      fixture.detectChanges();
      flush();

      // Wait for the initial writeValue promise.
      expect(instance.select.selected).toBeFalsy();

      instance.addOptions();
      fixture.detectChanges();
      flush();

      // Wait for the next writeValue promise.
      expect(instance.select.selected).toBe(instance.options.toArray()[1]);
    }));
  });

  describe('with a selectionChange event handler', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([SelectWithChangeEvent])));

    let fixture: ComponentFixture<SelectWithChangeEvent>;
    let trigger: HTMLElement;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(SelectWithChangeEvent);
      fixture.detectChanges();

      trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
    }));

    it('should emit an event when the selected option has changed', fakeAsync(() => {
      trigger.click();
      fixture.detectChanges();

      (overlayContainerElement.querySelector('mat-option') as HTMLElement).click();

      expect(fixture.componentInstance.changeListener).toHaveBeenCalled();
    }));

    it('should not emit multiple change events for the same option', fakeAsync(() => {
      trigger.click();
      fixture.detectChanges();

      const option = overlayContainerElement.querySelector('mat-option') as HTMLElement;

      option.click();
      option.click();

      expect(fixture.componentInstance.changeListener).toHaveBeenCalledTimes(1);
    }));

    it('should only emit one event when pressing arrow keys on closed select', fakeAsync(() => {
      const select = fixture.debugElement.query(By.css('mat-select'))!.nativeElement;
      dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);

      expect(fixture.componentInstance.changeListener).toHaveBeenCalledTimes(1);

      flush();
    }));
  });

  describe('with ngModel', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([NgModelSelect])));

    it('should disable itself when control is disabled using the property', fakeAsync(() => {
      const fixture = TestBed.createComponent(NgModelSelect);
      fixture.detectChanges();

      fixture.componentInstance.isDisabled = true;
      fixture.detectChanges();
      flush();

      fixture.detectChanges();
      const trigger =
          fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
      expect(getComputedStyle(trigger).getPropertyValue('cursor'))
        .withContext(`Expected cursor to be default arrow on disabled control.`).toEqual('default');

      trigger.click();
      fixture.detectChanges();

      expect(overlayContainerElement.textContent)
        .withContext(`Expected select panel to stay closed.`).toEqual('');
      expect(fixture.componentInstance.select.panelOpen)
        .withContext(`Expected select panelOpen property to stay false.`).toBe(false);

      fixture.componentInstance.isDisabled = false;
      fixture.detectChanges();
      flush();

      fixture.detectChanges();
      expect(getComputedStyle(trigger).getPropertyValue('cursor'))
        .withContext(`Expected cursor to be a pointer on enabled control.`).toEqual('pointer');

      trigger.click();
      fixture.detectChanges();

      expect(overlayContainerElement.textContent)
        .withContext(`Expected select panel to open normally on re-enabled control`)
        .toContain('Steak');
      expect(fixture.componentInstance.select.panelOpen)
        .withContext(`Expected select panelOpen property to become true.`).toBe(true);
    }));
  });

  describe('with ngIf', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([NgIfSelect])));

    it('should handle nesting in an ngIf', fakeAsync(() => {
      const fixture = TestBed.createComponent(NgIfSelect);
      fixture.detectChanges();

      fixture.componentInstance.isShowing = true;
      fixture.detectChanges();

      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
      trigger.style.width = '300px';

      trigger.click();
      fixture.detectChanges();
      flush();

      const value = fixture.debugElement.query(By.css('.mat-select-value'))!;
      expect(value.nativeElement.textContent)
        .withContext(`Expected trigger to be populated by the control's initial value.`)
        .toContain('Pizza');

      const pane = overlayContainerElement.querySelector('.cdk-overlay-pane') as HTMLElement;
      expect(pane.style.minWidth).toEqual('300px');

      expect(fixture.componentInstance.select.panelOpen).toBe(true);
      expect(overlayContainerElement.textContent).toContain('Steak');
      expect(overlayContainerElement.textContent).toContain('Pizza');
      expect(overlayContainerElement.textContent).toContain('Tacos');
    }));
  });

  describe('with multiple mat-select elements in one view', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([ManySelects])));

      let fixture: ComponentFixture<ManySelects>;
      let triggers: DebugElement[];
      let options: NodeListOf<HTMLElement>;

      beforeEach(fakeAsync(() => {
        fixture = TestBed.createComponent(ManySelects);
        fixture.detectChanges();
        triggers = fixture.debugElement.queryAll(By.css('.mat-select-trigger'));

        triggers[0].nativeElement.click();
        fixture.detectChanges();
        flush();

        options = overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;
      }));

      it('should set the option id', fakeAsync(() => {
        const firstOptionID = options[0].id;

        expect(options[0].id)
          .withContext(`Expected option ID to have the correct prefix.`).toContain('mat-option');
        expect(options[0].id).not.toEqual(options[1].id, `Expected option IDs to be unique.`);

        const backdrop =
            overlayContainerElement.querySelector('.cdk-overlay-backdrop') as HTMLElement;
        backdrop.click();
        fixture.detectChanges();
        flush();

        triggers[1].nativeElement.click();
        fixture.detectChanges();
        flush();

        options =
            overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;
        expect(options[0].id)
          .withContext(`Expected option ID to have the correct prefix.`).toContain('mat-option');
        expect(options[0].id).not.toEqual(firstOptionID, `Expected option IDs to be unique.`);
        expect(options[0].id).not.toEqual(options[1].id, `Expected option IDs to be unique.`);
      }));
  });

  describe('with floatLabel', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([FloatLabelSelect])));

    let fixture: ComponentFixture<FloatLabelSelect>;
    let formField: HTMLElement;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(FloatLabelSelect);
      fixture.detectChanges();
      formField = fixture.debugElement.query(By.css('.mat-form-field'))!.nativeElement;
    }));

    it('should be able to disable the floating label', fakeAsync(() => {
      fixture.componentInstance.floatLabel = 'never';
      fixture.detectChanges();

      expect(formField.classList.contains('mat-form-field-can-float'))
        .withContext('Floating label should be disabled').toBe(false);

      fixture.componentInstance.control.setValue('pizza-1');
      fixture.detectChanges();

      expect(formField.classList.contains('mat-form-field-can-float'))
        .withContext('Floating label should be disabled').toBe(false);
    }));

    it('should be able to always float the label', fakeAsync(() => {
      expect(fixture.componentInstance.control.value).toBeFalsy();

      fixture.componentInstance.floatLabel = 'always';
      fixture.detectChanges();

      expect(formField.classList.contains('mat-form-field-can-float'))
        .withContext('Label should be able to float').toBe(true);
      expect(formField.classList.contains('mat-form-field-should-float'))
        .withContext('Label should be floating').toBe(true);
    }));

    it('should default to global floating label type', fakeAsync(() => {
      fixture.destroy();

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          MatFormFieldModule,
          MatSelectModule,
          ReactiveFormsModule,
          FormsModule,
          NoopAnimationsModule
        ],
        declarations: [
          FloatLabelSelect
        ],
        providers: [{
          provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
          useValue: {floatLabel: 'always'}
        }]
      });

      fixture = TestBed.createComponent(FloatLabelSelect);
      fixture.componentInstance.floatLabel = null;
      fixture.detectChanges();
      formField = fixture.debugElement.query(By.css('.mat-form-field'))!.nativeElement;

      expect(formField.classList.contains('mat-form-field-can-float'))
        .withContext('Label should be able to float').toBe(true);
      expect(formField.classList.contains('mat-form-field-should-float'))
        .withContext('Label should be floating').toBe(true);
    }));

    it('should float the label on focus if it has a placeholder', fakeAsync(() => {
      expect(fixture.componentInstance.placeholder).toBeTruthy();

      fixture.componentInstance.floatLabel = 'auto';
      fixture.detectChanges();

      dispatchFakeEvent(fixture.nativeElement.querySelector('.mat-select'), 'focus');
      fixture.detectChanges();

      expect(formField.classList.contains('mat-form-field-should-float'))
        .withContext('Label should be floating').toBe(true);
    }));
  });

  describe('with a sibling component that throws an error', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([
      SelectWithErrorSibling,
      ThrowsErrorOnInit,
    ])));

    it('should not crash the browser when a sibling throws an error on init', fakeAsync(() => {
      // Note that this test can be considered successful if the error being thrown didn't
      // end up crashing the testing setup altogether.
      expect(() => {
        TestBed.createComponent(SelectWithErrorSibling).detectChanges();
      }).toThrowError(new RegExp('Oh no!', 'g'));
    }));
  });

  describe('with tabindex', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([SelectWithPlainTabindex])));

    it('should be able to set the tabindex via the native attribute', fakeAsync(() => {
      const fixture = TestBed.createComponent(SelectWithPlainTabindex);
      fixture.detectChanges();

      const select = fixture.debugElement.query(By.css('mat-select'))!.nativeElement;
      expect(select.getAttribute('tabindex')).toBe('5');
    }));
  });

  describe('change events', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([SelectWithPlainTabindex])));

    it('should complete the stateChanges stream on destroy', () => {
      const fixture = TestBed.createComponent(SelectWithPlainTabindex);
      fixture.detectChanges();

      const debugElement = fixture.debugElement.query(By.directive(MatSelect))!;
      const select = debugElement.componentInstance;

      const spy = jasmine.createSpy('stateChanges complete');
      const subscription = select.stateChanges.subscribe(undefined, undefined, spy);

      fixture.destroy();
      expect(spy).toHaveBeenCalled();
      subscription.unsubscribe();
    });
  });

  describe('when initially hidden', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([BasicSelectInitiallyHidden])));

    it('should set the width of the overlay if the element was hidden initially', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectInitiallyHidden);
      fixture.detectChanges();

      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
      trigger.style.width = '200px';
      fixture.componentInstance.isVisible = true;
      fixture.detectChanges();

      trigger.click();
      fixture.detectChanges();
      flush();

      const pane = overlayContainerElement.querySelector('.cdk-overlay-pane') as HTMLElement;
      expect(pane.style.minWidth).toBe('200px');
    }));
  });

  describe('with no placeholder', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([BasicSelectNoPlaceholder])));

    it('should set the width of the overlay if there is no placeholder', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectNoPlaceholder);

      fixture.detectChanges();
      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;

      trigger.click();
      fixture.detectChanges();
      flush();

      const pane = overlayContainerElement.querySelector('.cdk-overlay-pane') as HTMLElement;
      expect(parseInt(pane.style.minWidth as string)).toBeGreaterThan(0);
    }));
  });

  describe('with theming', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([BasicSelectWithTheming])));

    let fixture: ComponentFixture<BasicSelectWithTheming>;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(BasicSelectWithTheming);
      fixture.detectChanges();
    }));

    it('should transfer the theme to the select panel', fakeAsync(() => {
      fixture.componentInstance.theme = 'warn';
      fixture.detectChanges();

      fixture.componentInstance.select.open();
      fixture.detectChanges();

      const panel = overlayContainerElement.querySelector('.mat-select-panel')! as HTMLElement;
      expect(panel.classList).toContain('mat-warn');
    }));
  });

  describe('when invalid inside a form', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([InvalidSelectInForm])));

    it('should not throw SelectionModel errors in addition to ngModel errors', fakeAsync(() => {
      const fixture = TestBed.createComponent(InvalidSelectInForm);

      // The first change detection run will throw the "ngModel is missing a name" error.
      expect(() => fixture.detectChanges()).toThrowError(/the name attribute must be set/g);

      // The second run shouldn't throw selection-model related errors.
      expect(() => fixture.detectChanges()).not.toThrow();
    }));
  });

  describe('with ngModel using compareWith', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([NgModelCompareWithSelect])));

    let fixture: ComponentFixture<NgModelCompareWithSelect>;
    let instance: NgModelCompareWithSelect;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(NgModelCompareWithSelect);
      instance = fixture.componentInstance;
      fixture.detectChanges();
    }));

    describe('comparing by value', () => {

      it('should have a selection', fakeAsync(() => {
        const selectedOption = instance.select.selected as MatOption;
        expect(selectedOption.value.value).toEqual('pizza-1');
      }));

      it('should update when making a new selection', fakeAsync(() => {
        instance.options.last._selectViaInteraction();
        fixture.detectChanges();
        flush();

        const selectedOption = instance.select.selected as MatOption;
        expect(instance.selectedFood.value).toEqual('tacos-2');
        expect(selectedOption.value.value).toEqual('tacos-2');
      }));
    });

    describe('comparing by reference', () => {
      beforeEach(fakeAsync(() => {
        spyOn(instance, 'compareByReference').and.callThrough();
        instance.useCompareByReference();
        fixture.detectChanges();
      }));

      it('should use the comparator', fakeAsync(() => {
        expect(instance.compareByReference).toHaveBeenCalled();
      }));

      it('should initialize with no selection despite having a value', fakeAsync(() => {
        expect(instance.selectedFood.value).toBe('pizza-1');
        expect(instance.select.selected).toBeUndefined();
      }));

      it('should not update the selection if value is copied on change', fakeAsync(() => {
        instance.options.first._selectViaInteraction();
        fixture.detectChanges();
        flush();

        expect(instance.selectedFood.value).toEqual('steak-0');
        expect(instance.select.selected).toBeUndefined();
      }));

      it('should throw an error when using a non-function comparator', fakeAsync(() => {
        instance.useNullComparator();

        expect(() => {
          fixture.detectChanges();
        }).toThrowError(wrappedErrorMessage(getMatSelectNonFunctionValueError()));
      }));
    });
  });

  describe(`when the select's value is accessed on initialization`, () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([SelectEarlyAccessSibling])));

    it('should not throw when trying to access the selected value on init in the view',
      fakeAsync(() => {
        expect(() => {
          TestBed.createComponent(SelectEarlyAccessSibling).detectChanges();
        }).not.toThrow();
      }));

    it('should not throw when reading selected value programmatically in single selection mode',
      fakeAsync(() => {
        expect(() => {
          const fixture = TestBed.createComponent(SelectEarlyAccessSibling);
          const select = fixture.debugElement.query(By.directive(MatSelect)).componentInstance;
          // We're checking that accessing the getter won't throw.
          select.multiple = false;
          return select.selected;
        }).not.toThrow();
      }));

    it('should not throw when reading selected value programmatically in multi selection mode',
      fakeAsync(() => {
        expect(() => {
          const fixture = TestBed.createComponent(SelectEarlyAccessSibling);
          const select = fixture.debugElement.query(By.directive(MatSelect)).componentInstance;
          // We're checking that accessing the getter won't throw.
          select.multiple = true;
          return select.selected;
        }).not.toThrow();
      }));
  });

  describe('with ngIf and mat-label', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([SelectWithNgIfAndLabel])));

    it('should not throw when using ngIf on a select with an associated label', fakeAsync(() => {
      expect(() => {
        const fixture = TestBed.createComponent(SelectWithNgIfAndLabel);
        fixture.detectChanges();
      }).not.toThrow();
    }));
  });

  describe('inside of a form group', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([SelectInsideFormGroup])));

    let fixture: ComponentFixture<SelectInsideFormGroup>;
    let testComponent: SelectInsideFormGroup;
    let select: HTMLElement;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(SelectInsideFormGroup);
      fixture.detectChanges();
      testComponent = fixture.componentInstance;
      select = fixture.debugElement.query(By.css('mat-select'))!.nativeElement;
    }));

    it('should not set the invalid class on a clean select', fakeAsync(() => {
      expect(testComponent.formGroup.untouched)
        .withContext('Expected the form to be untouched.').toBe(true);
      expect(testComponent.formControl.invalid)
        .withContext('Expected form control to be invalid.').toBe(true);
      expect(select.classList)
          .not.toContain('mat-select-invalid', 'Expected select not to appear invalid.');
      expect(select.getAttribute('aria-invalid'))
        .withContext('Expected aria-invalid to be set to false.').toBe('false');
    }));

    it('should appear as invalid if it becomes touched', fakeAsync(() => {
      expect(select.classList)
          .not.toContain('mat-select-invalid', 'Expected select not to appear invalid.');
      expect(select.getAttribute('aria-invalid'))
        .withContext('Expected aria-invalid to be set to false.').toBe('false');

      testComponent.formControl.markAsTouched();
      fixture.detectChanges();

      expect(select.classList)
        .withContext('Expected select to appear invalid.').toContain('mat-select-invalid');
      expect(select.getAttribute('aria-invalid'))
        .withContext('Expected aria-invalid to be set to true.').toBe('true');
    }));

    it('should not have the invalid class when the select becomes valid', fakeAsync(() => {
      testComponent.formControl.markAsTouched();
      fixture.detectChanges();

      expect(select.classList)
        .withContext('Expected select to appear invalid.').toContain('mat-select-invalid');
      expect(select.getAttribute('aria-invalid'))
        .withContext('Expected aria-invalid to be set to true.').toBe('true');

      testComponent.formControl.setValue('pizza-1');
      fixture.detectChanges();

      expect(select.classList)
          .not.toContain('mat-select-invalid', 'Expected select not to appear invalid.');
      expect(select.getAttribute('aria-invalid'))
        .withContext('Expected aria-invalid to be set to false.').toBe('false');
    }));

    it('should appear as invalid when the parent form group is submitted', fakeAsync(() => {
      expect(select.classList)
          .not.toContain('mat-select-invalid', 'Expected select not to appear invalid.');
      expect(select.getAttribute('aria-invalid'))
        .withContext('Expected aria-invalid to be set to false.').toBe('false');

      dispatchFakeEvent(fixture.debugElement.query(By.css('form'))!.nativeElement, 'submit');
      fixture.detectChanges();

      expect(select.classList)
        .withContext('Expected select to appear invalid.').toContain('mat-select-invalid');
      expect(select.getAttribute('aria-invalid'))
        .withContext('Expected aria-invalid to be set to true.').toBe('true');
    }));

    it('should render the error messages when the parent form is submitted', fakeAsync(() => {
      const debugEl = fixture.debugElement.nativeElement;

      expect(debugEl.querySelectorAll('mat-error').length)
        .withContext('Expected no error messages').toBe(0);

      dispatchFakeEvent(fixture.debugElement.query(By.css('form'))!.nativeElement, 'submit');
      fixture.detectChanges();

      expect(debugEl.querySelectorAll('mat-error').length)
        .withContext('Expected one error message').toBe(1);
    }));

    it('should override error matching behavior via injection token', fakeAsync(() => {
      const errorStateMatcher: ErrorStateMatcher = {
        isErrorState: jasmine.createSpy('error state matcher').and.returnValue(true)
      };

      fixture.destroy();

      TestBed.resetTestingModule().configureTestingModule({
        imports: [MatSelectModule, ReactiveFormsModule, FormsModule, NoopAnimationsModule],
        declarations: [SelectInsideFormGroup],
        providers: [{ provide: ErrorStateMatcher, useValue: errorStateMatcher }],
      });

      const errorFixture = TestBed.createComponent(SelectInsideFormGroup);
      const component = errorFixture.componentInstance;

      errorFixture.detectChanges();

      expect(component.select.errorState).toBe(true);
      expect(errorStateMatcher.isErrorState).toHaveBeenCalled();
    }));

    it('should notify that the state changed when the options have changed', fakeAsync(() => {
      testComponent.formControl.setValue('pizza-1');
      fixture.detectChanges();

      const spy = jasmine.createSpy('stateChanges spy');
      const subscription = testComponent.select.stateChanges.subscribe(spy);

      testComponent.options = [];
      fixture.detectChanges();
      tick();

      expect(spy).toHaveBeenCalled();
      subscription.unsubscribe();
    }));

  });

  describe('with custom error behavior', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([CustomErrorBehaviorSelect])));

    it('should be able to override the error matching behavior via an @Input', fakeAsync(() => {
      const fixture = TestBed.createComponent(CustomErrorBehaviorSelect);
      const component = fixture.componentInstance;
      const matcher = jasmine.createSpy('error state matcher').and.returnValue(true);

      fixture.detectChanges();

      expect(component.control.invalid).toBe(false);
      expect(component.select.errorState).toBe(false);

      fixture.componentInstance.errorStateMatcher = { isErrorState: matcher };
      fixture.detectChanges();

      expect(component.select.errorState).toBe(true);
      expect(matcher).toHaveBeenCalled();
    }));
  });

  describe('with preselected array values', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([
      SingleSelectWithPreselectedArrayValues,
    ])));

    it('should be able to preselect an array value in single-selection mode', fakeAsync(() => {
      const fixture = TestBed.createComponent(SingleSelectWithPreselectedArrayValues);
      fixture.detectChanges();
      flush();
      fixture.detectChanges();

      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;

      expect(trigger.textContent).toContain('Pizza');
      expect(fixture.componentInstance.options.toArray()[1].selected).toBe(true);
    }));
  });

  describe('with custom value accessor', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([
      CompWithCustomSelect,
      CustomSelectAccessor,
    ])));

    it('should support use inside a custom value accessor', fakeAsync(() => {
      const fixture = TestBed.createComponent(CompWithCustomSelect);
      spyOn(fixture.componentInstance.customAccessor, 'writeValue');
      fixture.detectChanges();

      expect(fixture.componentInstance.customAccessor.select.ngControl)
        .withContext('Expected mat-select NOT to inherit control from parent value accessor.')
        .toBeFalsy();
      expect(fixture.componentInstance.customAccessor.writeValue).toHaveBeenCalled();
    }));
  });

  describe('with a falsy value', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([FalsyValueSelect])));

    it('should be able to programmatically select a falsy option', fakeAsync(() => {
      const fixture = TestBed.createComponent(FalsyValueSelect);

      fixture.detectChanges();
      fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement.click();
      fixture.componentInstance.control.setValue(0);
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.options.first.selected)
        .withContext('Expected first option to be selected').toBe(true);
      expect(overlayContainerElement.querySelectorAll('mat-option')[0].classList)
        .withContext('Expected first option to be selected').toContain('mat-selected');
    }));
  });

  describe('with OnPush', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([
      BasicSelectOnPush,
      BasicSelectOnPushPreselected,
    ])));

    it('should set the trigger text based on the value when initialized', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectOnPushPreselected);

      fixture.detectChanges();
      flush();

      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;

      fixture.detectChanges();

      expect(trigger.textContent).toContain('Pizza');
    }));

    it('should update the trigger based on the value', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectOnPush);
      fixture.detectChanges();
      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;

      fixture.componentInstance.control.setValue('pizza-1');
      fixture.detectChanges();

      expect(trigger.textContent).toContain('Pizza');

      fixture.componentInstance.control.reset();
      fixture.detectChanges();

      expect(trigger.textContent).not.toContain('Pizza');
    }));
  });

  describe('with custom trigger', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([SelectWithCustomTrigger])));

    it('should allow the user to customize the label', fakeAsync(() => {
      const fixture = TestBed.createComponent(SelectWithCustomTrigger);
      fixture.detectChanges();

      fixture.componentInstance.control.setValue('pizza-1');
      fixture.detectChanges();

      const label = fixture.debugElement.query(By.css('.mat-select-value'))!.nativeElement;

      expect(label.textContent)
        .withContext('Expected the displayed text to be "Pizza" in reverse.').toContain('azziP');
    }));
  });

  describe('when reseting the value by setting null or undefined', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([ResetValuesSelect])));

    let fixture: ComponentFixture<ResetValuesSelect>;
    let trigger: HTMLElement;
    let formField: HTMLElement;
    let options: NodeListOf<HTMLElement>;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(ResetValuesSelect);
      fixture.detectChanges();
      trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
      formField = fixture.debugElement.query(By.css('.mat-form-field'))!.nativeElement;

      trigger.click();
      fixture.detectChanges();
      flush();

      options = overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;
      options[0].click();
      fixture.detectChanges();
      flush();
    }));

    it('should reset when an option with an undefined value is selected', fakeAsync(() => {
      options[4].click();
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.control.value).toBeUndefined();
      expect(fixture.componentInstance.select.selected).toBeFalsy();
      expect(formField.classList).not.toContain('mat-form-field-should-float');
      expect(trigger.textContent).not.toContain('Undefined');
    }));

    it('should reset when an option with a null value is selected', fakeAsync(() => {
      options[5].click();
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.control.value).toBeNull();
      expect(fixture.componentInstance.select.selected).toBeFalsy();
      expect(formField.classList).not.toContain('mat-form-field-should-float');
      expect(trigger.textContent).not.toContain('Null');
    }));

    it('should reset when a blank option is selected', fakeAsync(() => {
      options[6].click();
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.control.value).toBeUndefined();
      expect(fixture.componentInstance.select.selected).toBeFalsy();
      expect(formField.classList).not.toContain('mat-form-field-should-float');
      expect(trigger.textContent).not.toContain('None');
    }));

    it('should not mark the reset option as selected ', fakeAsync(() => {
      options[5].click();
      fixture.detectChanges();
      flush();

      fixture.componentInstance.select.open();
      fixture.detectChanges();
      flush();

      expect(options[5].classList).not.toContain('mat-selected');
    }));

    it('should not reset when any other falsy option is selected', fakeAsync(() => {
      options[3].click();
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.control.value).toBe(false);
      expect(fixture.componentInstance.select.selected).toBeTruthy();
      expect(formField.classList).toContain('mat-form-field-should-float');
      expect(trigger.textContent).toContain('Falsy');
    }));

    it('should not consider the reset values as selected when resetting the form control',
        fakeAsync(() => {
          expect(formField.classList).toContain('mat-form-field-should-float');

          fixture.componentInstance.control.reset();
          fixture.detectChanges();

          expect(fixture.componentInstance.control.value).toBeNull();
          expect(fixture.componentInstance.select.selected).toBeFalsy();
          expect(formField.classList).not.toContain('mat-form-field-should-float');
          expect(trigger.textContent).not.toContain('Null');
          expect(trigger.textContent).not.toContain('Undefined');
        }));
  });

  describe('with reset option and a form control', () => {
    let fixture: ComponentFixture<SelectWithResetOptionAndFormControl>;
    let options: HTMLElement[];

    beforeEach(fakeAsync(() => {
      configureMatSelectTestingModule([SelectWithResetOptionAndFormControl]);
      fixture = TestBed.createComponent(SelectWithResetOptionAndFormControl);
      fixture.detectChanges();
      fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement.click();
      fixture.detectChanges();
      options = Array.from(overlayContainerElement.querySelectorAll('mat-option'));
    }));

    it('should set the select value', fakeAsync(() => {
      fixture.componentInstance.control.setValue('a');
      fixture.detectChanges();
      expect(fixture.componentInstance.select.value).toBe('a');
    }));

    it('should reset the control value', fakeAsync(() => {
      fixture.componentInstance.control.setValue('a');
      fixture.detectChanges();

      options[0].click();
      fixture.detectChanges();
      flush();
      expect(fixture.componentInstance.control.value).toBe(undefined);
    }));

    it('should reflect the value in the form control', fakeAsync(() => {
      options[1].click();
      fixture.detectChanges();
      flush();
      expect(fixture.componentInstance.select.value).toBe('a');
      expect(fixture.componentInstance.control.value).toBe('a');
    }));
  });

  describe('without Angular forms', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([
      BasicSelectWithoutForms,
      BasicSelectWithoutFormsPreselected,
      BasicSelectWithoutFormsMultiple,
    ])));

    it('should set the value when options are clicked', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutForms);

      fixture.detectChanges();
      expect(fixture.componentInstance.selectedFood).toBeFalsy();

      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;

      trigger.click();
      fixture.detectChanges();
      flush();

      (overlayContainerElement.querySelector('mat-option') as HTMLElement).click();
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.selectedFood).toBe('steak-0');
      expect(fixture.componentInstance.select.value).toBe('steak-0');
      expect(trigger.textContent).toContain('Steak');

      trigger.click();
      fixture.detectChanges();
      flush();

      (overlayContainerElement.querySelectorAll('mat-option')[2] as HTMLElement).click();
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.selectedFood).toBe('sandwich-2');
      expect(fixture.componentInstance.select.value).toBe('sandwich-2');
      expect(trigger.textContent).toContain('Sandwich');
    }));

    it('should mark options as selected when the value is set', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutForms);

      fixture.detectChanges();
      fixture.componentInstance.selectedFood = 'sandwich-2';
      fixture.detectChanges();

      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
      expect(trigger.textContent).toContain('Sandwich');

      trigger.click();
      fixture.detectChanges();

      const option = overlayContainerElement.querySelectorAll('mat-option')[2];

      expect(option.classList).toContain('mat-selected');
      expect(fixture.componentInstance.select.value).toBe('sandwich-2');
    }));

    it('should reset the label when a null value is set', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutForms);

      fixture.detectChanges();
      expect(fixture.componentInstance.selectedFood).toBeFalsy();

      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;

      trigger.click();
      fixture.detectChanges();
      flush();

      (overlayContainerElement.querySelector('mat-option') as HTMLElement).click();
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.selectedFood).toBe('steak-0');
      expect(fixture.componentInstance.select.value).toBe('steak-0');
      expect(trigger.textContent).toContain('Steak');

      fixture.componentInstance.selectedFood = null;
      fixture.detectChanges();

      expect(fixture.componentInstance.select.value).toBeNull();
      expect(trigger.textContent).not.toContain('Steak');
    }));

    it('should reflect the preselected value', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutFormsPreselected);

      fixture.detectChanges();
      flush();

      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
      fixture.detectChanges();
      expect(trigger.textContent).toContain('Pizza');

      trigger.click();
      fixture.detectChanges();

      const option = overlayContainerElement.querySelectorAll('mat-option')[1];

      expect(option.classList).toContain('mat-selected');
      expect(fixture.componentInstance.select.value).toBe('pizza-1');
    }));

    it('should be able to select multiple values', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutFormsMultiple);

      fixture.detectChanges();
      expect(fixture.componentInstance.selectedFoods).toBeFalsy();

      const trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;

      trigger.click();
      fixture.detectChanges();

      const options =
          overlayContainerElement.querySelectorAll('mat-option') as NodeListOf<HTMLElement>;

      options[0].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedFoods).toEqual(['steak-0']);
      expect(fixture.componentInstance.select.value).toEqual(['steak-0']);
      expect(trigger.textContent).toContain('Steak');

      options[2].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedFoods).toEqual(['steak-0', 'sandwich-2']);
      expect(fixture.componentInstance.select.value).toEqual(['steak-0', 'sandwich-2']);
      expect(trigger.textContent).toContain('Steak, Sandwich');

      options[1].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedFoods).toEqual(['steak-0', 'pizza-1', 'sandwich-2']);
      expect(fixture.componentInstance.select.value).toEqual(['steak-0', 'pizza-1', 'sandwich-2']);
      expect(trigger.textContent).toContain('Steak, Pizza, Sandwich');
    }));

    it('should restore focus to the host element', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutForms);

      fixture.detectChanges();
      fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement.click();
      fixture.detectChanges();
      flush();

      (overlayContainerElement.querySelector('mat-option') as HTMLElement).click();
      fixture.detectChanges();
      flush();

      const select = fixture.debugElement.nativeElement.querySelector('mat-select');

      expect(document.activeElement)
        .withContext('Expected trigger to be focused.').toBe(select);
    }));

    it('should not restore focus to the host element when clicking outside', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutForms);
      const select = fixture.debugElement.nativeElement.querySelector('mat-select');

      fixture.detectChanges();
      select.focus(); // Focus manually since the programmatic click might not do it.
      fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement.click();
      fixture.detectChanges();
      flush();

      expect(document.activeElement)
        .withContext('Expected trigger to be focused.').toBe(select);

      select.blur(); // Blur manually since the programmatic click might not do it.
      (overlayContainerElement.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
      fixture.detectChanges();
      flush();

      expect(document.activeElement).not.toBe(select, 'Expected trigger not to be focused.');
    }));

    it('should update the data binding before emitting the change event', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutForms);
      const instance = fixture.componentInstance;
      const spy = jasmine.createSpy('change spy');

      fixture.detectChanges();
      instance.select.selectionChange.subscribe(() => spy(instance.selectedFood));

      expect(instance.selectedFood).toBeFalsy();

      fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement.click();
      fixture.detectChanges();
      flush();

      (overlayContainerElement.querySelector('mat-option') as HTMLElement).click();
      fixture.detectChanges();
      flush();

      expect(instance.selectedFood).toBe('steak-0');
      expect(spy).toHaveBeenCalledWith('steak-0');
    }));

    it('should select the active option when tabbing away while open', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutForms);
      fixture.detectChanges();
      const select = fixture.nativeElement.querySelector('.mat-select');

      expect(fixture.componentInstance.selectedFood).toBeFalsy();

      const trigger = fixture.nativeElement.querySelector('.mat-select-trigger');

      trigger.click();
      fixture.detectChanges();
      flush();

      dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
      fixture.detectChanges();
      dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
      fixture.detectChanges();

      dispatchKeyboardEvent(select, 'keydown', TAB);
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.selectedFood).toBe('sandwich-2');
      expect(fixture.componentInstance.select.value).toBe('sandwich-2');
      expect(trigger.textContent).toContain('Sandwich');
    }));

    it('should not select the active option when tabbing away while close', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutForms);
      fixture.detectChanges();
      const select = fixture.nativeElement.querySelector('.mat-select');

      expect(fixture.componentInstance.selectedFood).toBeFalsy();

      const trigger = fixture.nativeElement.querySelector('.mat-select-trigger');

      trigger.click();
      fixture.detectChanges();
      flush();

      dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
      fixture.detectChanges();
      dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
      fixture.detectChanges();
      dispatchKeyboardEvent(select, 'keydown', ESCAPE);
      fixture.detectChanges();

      dispatchKeyboardEvent(select, 'keydown', TAB);
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.selectedFood).toBeFalsy();
    }));

    it('should not change the multiple value selection when tabbing away', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutFormsMultiple);
      fixture.detectChanges();

      expect(fixture.componentInstance.selectedFoods)
        .withContext('Expected no value on init.').toBeFalsy();

      const select = fixture.nativeElement.querySelector('.mat-select');
      const trigger = fixture.nativeElement.querySelector('.mat-select-trigger');
      trigger.click();
      fixture.detectChanges();

      dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
      fixture.detectChanges();
      dispatchKeyboardEvent(select, 'keydown', DOWN_ARROW);
      fixture.detectChanges();

      dispatchKeyboardEvent(select, 'keydown', TAB);
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.selectedFoods)
        .withContext('Expected no value after tabbing away.')
        .toBeFalsy();
    }));

    it('should emit once when a reset value is selected', fakeAsync(() => {
      const fixture = TestBed.createComponent(BasicSelectWithoutForms);
      const instance = fixture.componentInstance;
      const spy = jasmine.createSpy('change spy');

      instance.selectedFood = 'sandwich-2';
      instance.foods[0].value = null;
      fixture.detectChanges();

      const subscription = instance.select.selectionChange.subscribe(spy);

      fixture.debugElement.query(By.css('.mat-select-trigger')).nativeElement.click();
      fixture.detectChanges();
      flush();

      (overlayContainerElement.querySelector('mat-option') as HTMLElement).click();
      fixture.detectChanges();
      flush();

      expect(spy).toHaveBeenCalledTimes(1);

      subscription.unsubscribe();
    }));

    it('should not emit the change event multiple times when a reset option is ' +
      'selected twice in a row', fakeAsync(() => {
        const fixture = TestBed.createComponent(BasicSelectWithoutForms);
        const instance = fixture.componentInstance;
        const spy = jasmine.createSpy('change spy');

        instance.foods[0].value = null;
        fixture.detectChanges();

        const subscription = instance.select.selectionChange.subscribe(spy);

        fixture.debugElement.query(By.css('.mat-select-trigger')).nativeElement.click();
        fixture.detectChanges();
        flush();

        (overlayContainerElement.querySelector('mat-option') as HTMLElement).click();
        fixture.detectChanges();
        flush();

        expect(spy).not.toHaveBeenCalled();

        fixture.debugElement.query(By.css('.mat-select-trigger')).nativeElement.click();
        fixture.detectChanges();
        flush();

        (overlayContainerElement.querySelector('mat-option') as HTMLElement).click();
        fixture.detectChanges();
        flush();

        expect(spy).not.toHaveBeenCalled();

        subscription.unsubscribe();
      }));

  });

  describe('with option centering disabled', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([
      SelectWithoutOptionCentering,
    ])));

    let fixture: ComponentFixture<SelectWithoutOptionCentering>;
    let trigger: HTMLElement;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(SelectWithoutOptionCentering);
      fixture.detectChanges();
      trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
    }));

    it('should not align the active option with the trigger if centering is disabled',
        fakeAsync(() => {
          trigger.click();
          fixture.detectChanges();
          flush();

          const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel')!;

          // The panel should be scrolled to 0 because centering the option disabled.
          // The panel should be scrolled to 0 because centering the option disabled.
expect(scrollContainer.scrollTop)
  .withContext(`Expected panel not to be scrolled.`).toEqual(0);
          // The trigger should contain 'Pizza' because it was preselected
          expect(trigger.textContent).toContain('Pizza');
          // The selected index should be 1 because it was preselected
          expect(fixture.componentInstance.options.toArray()[1].selected).toBe(true);
        }));
  });

  describe('positioning', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([
      BasicSelect,
      MultiSelect,
      SelectWithGroups,
      SelectWithIndirectDescendantGroups,
    ])));

    beforeEach((inject([ViewportRuler], (vr: ViewportRuler) => {
      viewportRuler = vr;
    })));

    let fixture: ComponentFixture<BasicSelect>;
    let trigger: HTMLElement;
    let formField: HTMLElement;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(BasicSelect);
      fixture.detectChanges();
      trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
      formField = fixture.debugElement.query(By.css('mat-form-field'))!.nativeElement;
    }));

    /**
     * Asserts that the given option is aligned with the trigger.
     * @param index The index of the option.
     * @param selectInstance Instance of the `mat-select` component to check against.
     */
    function checkTriggerAlignedWithOption(index: number, selectInstance =
        fixture.componentInstance.select): void {

      const overlayPane = overlayContainerElement.querySelector('.cdk-overlay-pane')!;
      const triggerTop = trigger.getBoundingClientRect().top;
      const overlayTop = overlayPane.getBoundingClientRect().top;
      const options = overlayPane.querySelectorAll('mat-option');
      const optionTop = options[index].getBoundingClientRect().top;
      const triggerFontSize = parseInt(window.getComputedStyle(trigger).fontSize || '0');
      const triggerLineHeightEm = 1.125;

      // Extra trigger height beyond the font size caused by the fact that the line-height is
      // greater than 1em.
      const triggerExtraLineSpaceAbove = (1 - triggerLineHeightEm) * triggerFontSize / 2;
      const topDifference = Math.floor(optionTop) -
          Math.floor(triggerTop - triggerFontSize - triggerExtraLineSpaceAbove);

      // Expect the coordinates to be within a pixel of each other. We can't rely on comparing
      // the exact value, because different browsers report the various sizes with slight (< 1px)
      // deviations.
      // Expect the coordinates to be within a pixel of each other. We can't rely on comparing
      // the exact value, because different browsers report the various sizes with slight (< 1px)
      // deviations.
      expect(Math.abs(topDifference) < 2)
        .withContext(`Expected trigger to align with option ${index}.`).toBe(true);

      // For the animation to start at the option's center, its origin must be the distance
      // from the top of the overlay to the option top + half the option height (48/2 = 24).
      const expectedOrigin = Math.floor(optionTop - overlayTop + 24);
      const rawYOrigin = selectInstance._transformOrigin.split(' ')[1].trim();
      const origin = Math.floor(parseInt(rawYOrigin));

      // Because the origin depends on the Y axis offset, we also have to
      // round down and check that the difference is within a pixel.
      // Because the origin depends on the Y axis offset, we also have to
      // round down and check that the difference is within a pixel.
      expect(Math.abs(expectedOrigin - origin) < 2)
        .withContext(`Expected panel animation to originate in the center of option ${index}.`)
        .toBe(true);
    }

    describe('ample space to open', () => {
      beforeEach(fakeAsync(() => {
        // these styles are necessary because we are first testing the overlay's position
        // if there is room for it to open to its full extent in either direction.
        formField.style.position = 'fixed';
        formField.style.top = '285px';
        formField.style.left = '20px';
      }));

      it('should align the first option with trigger text if no option is selected',
          fakeAsync(() => {
            // We shouldn't push it too far down for this one, because the default may
            // end up being too much when running the tests on mobile browsers.
            formField.style.top = '100px';
            trigger.click();
            fixture.detectChanges();
            flush();

            const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel')!;

            // The panel should be scrolled to 0 because centering the option is not possible.
            // The panel should be scrolled to 0 because centering the option is not possible.
expect(scrollContainer.scrollTop)
  .withContext(`Expected panel not to be scrolled.`).toEqual(0);
            checkTriggerAlignedWithOption(0);
          }));

      it('should align a selected option too high to be centered with the trigger text',
          fakeAsync(() => {
            // Select the second option, because it can't be scrolled any further downward
            fixture.componentInstance.control.setValue('pizza-1');
            fixture.detectChanges();

            trigger.click();
            fixture.detectChanges();
            flush();

            const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel')!;

            // The panel should be scrolled to 0 because centering the option is not possible.
            // The panel should be scrolled to 0 because centering the option is not possible.
expect(scrollContainer.scrollTop)
  .withContext(`Expected panel not to be scrolled.`).toEqual(0);
            checkTriggerAlignedWithOption(1);
          }));

      it('should align a selected option in the middle with the trigger text', fakeAsync(() => {
        // Select the fifth option, which has enough space to scroll to the center
        fixture.componentInstance.control.setValue('chips-4');
        fixture.detectChanges();
        flush();

        trigger.click();
        fixture.detectChanges();
        flush();

        const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel')!;

        // The selected option should be scrolled to the center of the panel.
        // This will be its original offset from the scrollTop - half the panel height + half
        // the option height. 4 (index) * 48 (option height) = 192px offset from scrollTop
        // 192 - 256/2 + 48/2 = 88px
        // The selected option should be scrolled to the center of the panel.
// This will be its original offset from the scrollTop - half the panel height + half
// the option height. 4 (index) * 48 (option height) = 192px offset from scrollTop
// 192 - 256/2 + 48/2 = 88px
expect(scrollContainer.scrollTop)
  .withContext(`Expected overlay panel to be scrolled to center the selected option.`).toEqual(88);

        checkTriggerAlignedWithOption(4);
      }));

      it('should align a selected option at the scroll max with the trigger text', fakeAsync(() => {
        // Select the last option in the list
        fixture.componentInstance.control.setValue('sushi-7');
        fixture.detectChanges();
        flush();

        trigger.click();
        fixture.detectChanges();
        flush();

        const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel')!;

        // The selected option should be scrolled to the max scroll position.
        // This will be the height of the scrollContainer - the panel height.
        // 8 options * 48px = 384 scrollContainer height, 384 - 256 = 128px max scroll
        // The selected option should be scrolled to the max scroll position.
// This will be the height of the scrollContainer - the panel height.
// 8 options * 48px = 384 scrollContainer height, 384 - 256 = 128px max scroll
expect(scrollContainer.scrollTop)
  .withContext(`Expected overlay panel to be scrolled to its maximum position.`).toEqual(128);

        checkTriggerAlignedWithOption(7);
      }));

      it('should account for preceding label groups when aligning the option', fakeAsync(() => {
        // Test is off-by-one on edge for some reason, but verified that it looks correct through
        // manual testing.
        if (platform.EDGE) {
          return;
        }

        fixture.destroy();

        const groupFixture = TestBed.createComponent(SelectWithGroups);
        groupFixture.detectChanges();
        trigger = groupFixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
        formField = groupFixture.debugElement.query(By.css('mat-form-field'))!.nativeElement;

        formField.style.position = 'fixed';
        formField.style.top = '200px';
        formField.style.left = '100px';

        // Select an option in the third group, which has a couple of group labels before it.
        groupFixture.componentInstance.control.setValue('vulpix-7');
        groupFixture.detectChanges();

        trigger.click();
        groupFixture.detectChanges();
        flush();

        const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel')!;

        // The selected option should be scrolled to the center of the panel.
        // This will be its original offset from the scrollTop - half the panel height + half the
        // option height. 10 (option index + 3 group labels before it) * 48 (option height) = 480
        // 480 (offset from scrollTop) - 256/2 + 48/2 = 376px
        // The selected option should be scrolled to the center of the panel.
        // This will be its original offset from the scrollTop - half the panel height + half the
        // option height. 10 (option index + 3 group labels before it) * 48 (option height) = 480
        // 480 (offset from scrollTop) - 256/2 + 48/2 = 376px
        expect(Math.floor(scrollContainer.scrollTop))
          .withContext(`Expected overlay panel to be scrolled to center the selected option.`)
          .toBe(376);

        checkTriggerAlignedWithOption(7, groupFixture.componentInstance.select);
      }));

      it('should account for indirect preceding label groups when aligning the option',
        fakeAsync(() => {
          // Test is off-by-one on edge for some reason, but verified that it looks correct through
          // manual testing.
          if (platform.EDGE) {
            return;
          }

          fixture.destroy();

          const groupFixture = TestBed.createComponent(SelectWithIndirectDescendantGroups);
          groupFixture.detectChanges();
          trigger = groupFixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
          formField = groupFixture.debugElement.query(By.css('mat-form-field'))!.nativeElement;

          formField.style.position = 'fixed';
          formField.style.top = '200px';
          formField.style.left = '100px';

          // Select an option in the third group, which has a couple of group labels before it.
          groupFixture.componentInstance.control.setValue('vulpix-7');
          groupFixture.detectChanges();

          trigger.click();
          groupFixture.detectChanges();
          flush();

          const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel')!;

          // The selected option should be scrolled to the center of the panel.
          // This will be its original offset from the scrollTop - half the panel height + half the
          // option height. 10 (option index + 3 group labels before it) * 48 (option height) = 480
          // 480 (offset from scrollTop) - 256/2 + 48/2 = 376px
          // The selected option should be scrolled to the center of the panel.
// This will be its original offset from the scrollTop - half the panel height + half the
// option height. 10 (option index + 3 group labels before it) * 48 (option height) = 480
// 480 (offset from scrollTop) - 256/2 + 48/2 = 376px
expect(Math.floor(scrollContainer.scrollTop))
  .withContext(`Expected overlay panel to be scrolled to center the selected option.`).toBe(376);

          checkTriggerAlignedWithOption(7, groupFixture.componentInstance.select);
        }));

    });

    describe('limited space to open vertically', () => {
      beforeEach(fakeAsync(() => {
        formField.style.position = 'fixed';
        formField.style.left = '20px';
      }));

      it('should adjust position of centered option if there is little space above',
          fakeAsync(() => {
            const selectMenuHeight = 256;
            const selectMenuViewportPadding = 8;
            const selectItemHeight = 48;
            const selectedIndex = 4;
            const fontSize = 16;
            const lineHeightEm = 1.125;
            const expectedExtraScroll = 5;

            // Trigger element height.
            const triggerHeight = fontSize * lineHeightEm;

            // Ideal space above selected item in order to center it.
            const idealSpaceAboveSelectedItem = (selectMenuHeight - selectItemHeight) / 2;

            // Actual space above selected item.
            const actualSpaceAboveSelectedItem = selectItemHeight * selectedIndex;

            // Ideal scroll position to center.
            const idealScrollTop = actualSpaceAboveSelectedItem - idealSpaceAboveSelectedItem;

            // Top-most select-position that allows for perfect centering.
            const topMostPositionForPerfectCentering =
                idealSpaceAboveSelectedItem + selectMenuViewportPadding +
                (selectItemHeight - triggerHeight) / 2;

            // Position of select relative to top edge of mat-form-field.
            const formFieldTopSpace =
                trigger.getBoundingClientRect().top - formField.getBoundingClientRect().top;

            const formFieldTop =
                topMostPositionForPerfectCentering - formFieldTopSpace - expectedExtraScroll;

            formField.style.top = `${formFieldTop}px`;

            // Select an option in the middle of the list
            fixture.componentInstance.control.setValue('chips-4');
            fixture.detectChanges();
            flush();

            trigger.click();
            fixture.detectChanges();
            flush();

            const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel')!;

            expect(Math.ceil(scrollContainer.scrollTop))
              .withContext(`Expected panel to adjust scroll position to fit in viewport.`)
              .toEqual(Math.ceil(idealScrollTop + 5));

            checkTriggerAlignedWithOption(4);
          }));

      it('should adjust position of centered option if there is little space below',
          fakeAsync(() => {
            const selectMenuHeight = 256;
            const selectMenuViewportPadding = 8;
            const selectItemHeight = 48;
            const selectedIndex = 4;
            const fontSize = 16;
            const lineHeightEm = 1.125;
            const expectedExtraScroll = 5;

            // Trigger element height.
            const triggerHeight = fontSize * lineHeightEm;

            // Ideal space above selected item in order to center it.
            const idealSpaceAboveSelectedItem = (selectMenuHeight - selectItemHeight) / 2;

            // Actual space above selected item.
            const actualSpaceAboveSelectedItem = selectItemHeight * selectedIndex;

            // Ideal scroll position to center.
            const idealScrollTop = actualSpaceAboveSelectedItem - idealSpaceAboveSelectedItem;

            // Bottom-most select-position that allows for perfect centering.
            const bottomMostPositionForPerfectCentering =
                idealSpaceAboveSelectedItem + selectMenuViewportPadding +
                (selectItemHeight - triggerHeight) / 2;

            // Position of select relative to bottom edge of mat-form-field:
            const formFieldBottomSpace =
                formField.getBoundingClientRect().bottom - trigger.getBoundingClientRect().bottom;

            const formFieldBottom =
                bottomMostPositionForPerfectCentering - formFieldBottomSpace - expectedExtraScroll;

            // Push the select to a position with not quite enough space on the bottom to open
            // with the option completely centered (needs 113px at least: 256/2 - 48/2 + 9)
            formField.style.bottom = `${formFieldBottom}px`;

            // Select an option in the middle of the list
            fixture.componentInstance.control.setValue('chips-4');
            fixture.detectChanges();
            flush();

            fixture.detectChanges();

            trigger.click();
            fixture.detectChanges();
            flush();

            const scrollContainer = document.querySelector('.cdk-overlay-pane .mat-select-panel')!;

            // Scroll should adjust by the difference between the bottom space available
            // (56px from the bottom of the screen - 8px padding = 48px)
            // and the height of the panel below the option (113px).
            // 113px - 48px = 75px difference. Original scrollTop 88px - 75px = 23px
            const difference = Math.ceil(scrollContainer.scrollTop) -
                Math.ceil(idealScrollTop - expectedExtraScroll);

            // Note that different browser/OS combinations report the different dimensions with
            // slight deviations (< 1px). We round the expectation and check that the values
            // are within a pixel of each other to avoid flakes.
            // Note that different browser/OS combinations report the different dimensions with
            // slight deviations (< 1px). We round the expectation and check that the values
            // are within a pixel of each other to avoid flakes.
            expect(Math.abs(difference) < 2)
              .withContext(`Expected panel to adjust scroll position to fit in viewport.`)
              .toBe(true);

            checkTriggerAlignedWithOption(4);
          }));

      it('should fall back to "above" positioning if scroll adjustment will not help',
          fakeAsync(() => {
            // Push the select to a position with not enough space on the bottom to open
            formField.style.bottom = '56px';
            fixture.detectChanges();

            // Select an option that cannot be scrolled any farther upward
            fixture.componentInstance.control.setValue('coke-0');
            fixture.detectChanges();

            trigger.click();
            fixture.detectChanges();
            flush();

            const overlayPane = document.querySelector('.cdk-overlay-pane')!;
            const triggerBottom = trigger.getBoundingClientRect().bottom;
            const overlayBottom = overlayPane.getBoundingClientRect().bottom;
            const scrollContainer = overlayPane.querySelector('.mat-select-panel')!;

            // Expect no scroll to be attempted
            // Expect no scroll to be attempted
            expect(scrollContainer.scrollTop)
              .withContext(`Expected panel not to be scrolled.`).toEqual(0);

            const difference = Math.floor(overlayBottom) - Math.floor(triggerBottom);

            // Check that the values are within a pixel of each other. This avoids sub-pixel
            // deviations between OS and browser versions.
            // Check that the values are within a pixel of each other. This avoids sub-pixel
            // deviations between OS and browser versions.
            expect(Math.abs(difference) < 2)
              .withContext(`Expected trigger bottom to align with overlay bottom.`).toEqual(true);

            expect(fixture.componentInstance.select._transformOrigin)
              .withContext(`Expected panel animation to originate at the bottom.`)
              .toContain(`bottom`);
          }));

      it('should fall back to "below" positioning if scroll adjustment won\'t help',
          fakeAsync(() => {
            // Push the select to a position with not enough space on the top to open
            formField.style.top = '85px';

            // Select an option that cannot be scrolled any farther downward
            fixture.componentInstance.control.setValue('sushi-7');
            fixture.detectChanges();
            flush();

            trigger.click();
            fixture.detectChanges();
            flush();

            const overlayPane = document.querySelector('.cdk-overlay-pane')!;
            const triggerTop = trigger.getBoundingClientRect().top;
            const overlayTop = overlayPane.getBoundingClientRect().top;
            const scrollContainer = overlayPane.querySelector('.mat-select-panel')!;

            // Expect scroll to remain at the max scroll position
            // Expect scroll to remain at the max scroll position
            expect(scrollContainer.scrollTop)
              .withContext(`Expected panel to be at max scroll.`).toEqual(128);

            expect(Math.floor(overlayTop))
              .withContext(`Expected trigger top to align with overlay top.`)
              .toEqual(Math.floor(triggerTop));

            expect(fixture.componentInstance.select._transformOrigin)
              .withContext(`Expected panel animation to originate at the top.`).toContain(`top`);
          }));

    });

    describe('limited space to open horizontally', () => {
      beforeEach(fakeAsync(() => {
        formField.style.position = 'absolute';
        formField.style.top = '200px';
      }));

      it('should stay within the viewport when overflowing on the left in ltr', fakeAsync(() => {
        formField.style.left = '-100px';
        trigger.click();
        fixture.detectChanges();
        flush();

        const panelLeft = document.querySelector('.mat-select-panel')!.getBoundingClientRect().left;

        expect(panelLeft)
          .withContext(`Expected select panel to be inside the viewport in ltr.`)
          .toBeGreaterThan(0);
      }));

      it('should stay within the viewport when overflowing on the left in rtl', fakeAsync(() => {
        dir.value = 'rtl';
        formField.style.left = '-100px';
        trigger.click();
        fixture.detectChanges();
        flush();

        const panelLeft = document.querySelector('.mat-select-panel')!.getBoundingClientRect().left;

        expect(panelLeft)
          .withContext(`Expected select panel to be inside the viewport in rtl.`)
          .toBeGreaterThan(0);
      }));

      it('should stay within the viewport when overflowing on the right in ltr', fakeAsync(() => {
        formField.style.right = '-100px';
        trigger.click();
        fixture.detectChanges();
        flush();

        const viewportRect = viewportRuler.getViewportRect().right;
        const panelRight = document.querySelector('.mat-select-panel')!
            .getBoundingClientRect().right;

        expect(viewportRect - panelRight)
          .withContext(`Expected select panel to be inside the viewport in ltr.`)
          .toBeGreaterThan(0);
      }));

      it('should stay within the viewport when overflowing on the right in rtl', fakeAsync(() => {
        dir.value = 'rtl';
        formField.style.right = '-100px';
        trigger.click();
        fixture.detectChanges();
        flush();

        const viewportRect = viewportRuler.getViewportRect().right;
        const panelRight = document.querySelector('.mat-select-panel')!
            .getBoundingClientRect().right;

        expect(viewportRect - panelRight)
          .withContext(`Expected select panel to be inside the viewport in rtl.`)
          .toBeGreaterThan(0);
      }));

      it('should keep the position within the viewport on repeat openings', fakeAsync(() => {
        formField.style.left = '-100px';
        trigger.click();
        fixture.detectChanges();
        flush();

        let panelLeft = document.querySelector('.mat-select-panel')!.getBoundingClientRect().left;

        expect(panelLeft)
          .withContext(`Expected select panel to be inside the viewport.`)
          .toBeGreaterThanOrEqual(0);

        fixture.componentInstance.select.close();
        fixture.detectChanges();
        flush();

        trigger.click();
        fixture.detectChanges();
        flush();

        panelLeft = document.querySelector('.mat-select-panel')!.getBoundingClientRect().left;

        expect(panelLeft)
          .withContext(`Expected select panel continue being inside the viewport.`)
          .toBeGreaterThanOrEqual(0);
      }));
    });

    describe('when scrolled', () => {
      const startingWindowHeight = window.innerHeight;

      // Need to set the scrollTop two different ways to support
      // both Chrome and Firefox.
      function setScrollTop(num: number) {
        document.body.scrollTop = num;
        document.documentElement!.scrollTop = num;
      }

      beforeEach(fakeAsync(() => {
        // Make the div above the select very tall, so the page will scroll
        fixture.componentInstance.heightAbove = 2000;
        fixture.detectChanges();
        setScrollTop(0);

        // Give the select enough horizontal space to open
        formField.style.marginLeft = '20px';
        formField.style.marginRight = '20px';
      }));

      it('should align the first option properly when scrolled', fakeAsync(() => {
        // Give the select enough space to open
        fixture.componentInstance.heightBelow = 400;
        fixture.detectChanges();

        // Space that is needed in order to show the menu below the trigger.
        // 256 (height of the menu overlay) - 45 (estimated height of the trigger)
        const requiredSpaceBelow = 256 - 45;

        // Scroll the select into view. Make sure that there is enough space for the menu
        // to open below the trigger (depending on the screen resolution)
        setScrollTop(2000 - requiredSpaceBelow);


        // In the iOS simulator (BrowserStack & SauceLabs), adding the content to the
        // body causes karma's iframe for the test to stretch to fit that content once we attempt to
        // scroll the page. Setting width / height / maxWidth / maxHeight on the iframe does not
        // successfully constrain its size. As such, skip assertions in environments where the
        // window size has changed since the start of the test.
        if (window.innerHeight > startingWindowHeight) {
          return;
        }

        trigger.click();
        fixture.detectChanges();
        flush();

        checkTriggerAlignedWithOption(0);
      }));

      it('should align a centered option properly when scrolled', fakeAsync(() => {
        // Give the select enough space to open
        fixture.componentInstance.heightBelow = 400;
        fixture.detectChanges();

        fixture.componentInstance.control.setValue('chips-4');
        fixture.detectChanges();
        flush();

        // Space that is needed in order to show the menu below the trigger.
        // 256 (height of the menu overlay) - 45 (estimated height of the trigger)
        // Even though there might be less options displayed below the trigger because the
        // selected option is the fourth item, we want to make sure we have enough space here.
        const requiredSpaceBelow = 256 - 45;

        // Scroll the select into view. Make sure that there is enough space for the menu
        // to open below the trigger (depending on the screen resolution)
        setScrollTop(2000 - requiredSpaceBelow);

        // In the iOS simulator (BrowserStack & SauceLabs), adding the content to the
        // body causes karma's iframe for the test to stretch to fit that content once we attempt
        // to scroll the page. Setting width / height / maxWidth / maxHeight on the iframe does
        // not successfully constrain its size. As such, skip assertions in environments where the
        // window size has changed since the start of the test.
        if (window.innerHeight > startingWindowHeight) {
          return;
        }

        trigger.click();
        fixture.detectChanges();
        flush();

        checkTriggerAlignedWithOption(4);
      }));

      it('should align a centered option properly when scrolling while the panel is open',
          fakeAsync(() => {
            fixture.componentInstance.heightBelow = 400;
            fixture.componentInstance.heightAbove = 400;
            fixture.componentInstance.control.setValue('chips-4');
            fixture.detectChanges();
            flush();

            trigger.click();
            fixture.detectChanges();
            flush();

            setScrollTop(100);
            scrolledSubject.next();
            fixture.detectChanges();

            checkTriggerAlignedWithOption(4);
          }));

      it('should fall back to "above" positioning properly when scrolled', fakeAsync(() => {
        // Give the select insufficient space to open below the trigger
        fixture.componentInstance.heightAbove = 0;
        fixture.componentInstance.heightBelow = 100;
        trigger.style.marginTop = '2000px';
        fixture.detectChanges();

        // Scroll the select into view
        setScrollTop(1400);

        // In the iOS simulator (BrowserStack & SauceLabs), adding the content to the
        // body causes karma's iframe for the test to stretch to fit that content once we attempt to
        // scroll the page. Setting width / height / maxWidth / maxHeight on the iframe does not
        // successfully constrain its size. As such, skip assertions in environments where the
        // window size has changed since the start of the test.
        if (window.innerHeight > startingWindowHeight) {
          return;
        }

        trigger.click();
        fixture.detectChanges();
        flush();

        const overlayPane = overlayContainerElement.querySelector('.cdk-overlay-pane')!;
        const triggerBottom = trigger.getBoundingClientRect().bottom;
        const overlayBottom = overlayPane.getBoundingClientRect().bottom;
        const difference = Math.floor(overlayBottom) - Math.floor(triggerBottom);

        // Check that the values are within a pixel of each other. This avoids sub-pixel
        // deviations between OS and browser versions.
        // Check that the values are within a pixel of each other. This avoids sub-pixel
        // deviations between OS and browser versions.
        expect(Math.abs(difference) < 2)
          .withContext(`Expected trigger bottom to align with overlay bottom.`).toEqual(true);
      }));

      it('should fall back to "below" positioning properly when scrolled', fakeAsync(() => {
        // Give plenty of space for the select to open below the trigger
        fixture.componentInstance.heightBelow = 650;
        fixture.detectChanges();

        // Select an option too low in the list to fit in limited space above
        fixture.componentInstance.control.setValue('sushi-7');
        fixture.detectChanges();

        // Scroll the select so that it has insufficient space to open above the trigger
        setScrollTop(1950);

        // In the iOS simulator (BrowserStack & SauceLabs), adding the content to the
        // body causes karma's iframe for the test to stretch to fit that content once we attempt to
        // scroll the page. Setting width / height / maxWidth / maxHeight on the iframe does not
        // successfully constrain its size. As such, skip assertions in environments where the
        // window size has changed since the start of the test.
        if (window.innerHeight > startingWindowHeight) {
          return;
        }

        trigger.click();
        fixture.detectChanges();
        flush();

        const overlayPane = overlayContainerElement.querySelector('.cdk-overlay-pane')!;
        const triggerTop = trigger.getBoundingClientRect().top;
        const overlayTop = overlayPane.getBoundingClientRect().top;

        expect(Math.floor(overlayTop))
          .withContext(`Expected trigger top to align with overlay top.`)
          .toEqual(Math.floor(triggerTop));
      }));
    });

    describe('x-axis positioning', () => {
      beforeEach(fakeAsync(() => {
        formField.style.position = 'fixed';
        formField.style.left = '30px';
      }));

      it('should align the trigger and the selected option on the x-axis in ltr', fakeAsync(() => {
        trigger.click();
        fixture.detectChanges();
        flush();

        const triggerLeft = trigger.getBoundingClientRect().left;
        const firstOptionLeft = document.querySelector('.cdk-overlay-pane mat-option')!
            .getBoundingClientRect().left;

        // Each option is 32px wider than the trigger, so it must be adjusted 16px
        // to ensure the text overlaps correctly.
        // Each option is 32px wider than the trigger, so it must be adjusted 16px
        // to ensure the text overlaps correctly.
        expect(Math.floor(firstOptionLeft))
          .withContext(`Expected trigger to align with the selected option on the x-axis in LTR.`)
          .toEqual(Math.floor(triggerLeft - 16));
      }));

      it('should align the trigger and the selected option on the x-axis in rtl', fakeAsync(() => {
        dir.value = 'rtl';
        fixture.detectChanges();

        trigger.click();
        fixture.detectChanges();
        flush();

        const triggerRight = trigger.getBoundingClientRect().right;
        const firstOptionRight =
            document.querySelector('.cdk-overlay-pane mat-option')!.getBoundingClientRect().right;

        // Each option is 32px wider than the trigger, so it must be adjusted 16px
        // to ensure the text overlaps correctly.
        // Each option is 32px wider than the trigger, so it must be adjusted 16px
        // to ensure the text overlaps correctly.
        expect(Math.floor(firstOptionRight))
          .withContext(`Expected trigger to align with the selected option on the x-axis in RTL.`)
          .toEqual(Math.floor(triggerRight + 16));
      }));
    });

    describe('x-axis positioning in multi select mode', () => {
      let multiFixture: ComponentFixture<MultiSelect>;

      beforeEach(fakeAsync(() => {
        multiFixture = TestBed.createComponent(MultiSelect);
        multiFixture.detectChanges();
        formField = multiFixture.debugElement.query(By.css('.mat-form-field'))!.nativeElement;
        trigger = multiFixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;

        formField.style.position = 'fixed';
        formField.style.left = '60px';
      }));

      it('should adjust for the checkbox in ltr', fakeAsync(() => {
        trigger.click();
        multiFixture.detectChanges();
        flush();

        const triggerLeft = trigger.getBoundingClientRect().left;
        const firstOptionLeft =
            document.querySelector('.cdk-overlay-pane mat-option')!.getBoundingClientRect().left;

        // 44px accounts for the checkbox size, margin and the panel's padding.
        // 44px accounts for the checkbox size, margin and the panel's padding.
        expect(Math.floor(firstOptionLeft))
          .withContext(`Expected trigger label to align along x-axis, accounting for the checkbox.`)
          .toEqual(Math.floor(triggerLeft - 40));
      }));

      it('should adjust for the checkbox in rtl', fakeAsync(() => {
        dir.value = 'rtl';
        trigger.click();
        multiFixture.detectChanges();
        flush();

        const triggerRight = trigger.getBoundingClientRect().right;
        const firstOptionRight =
            document.querySelector('.cdk-overlay-pane mat-option')!.getBoundingClientRect().right;

        // 44px accounts for the checkbox size, margin and the panel's padding.
        // 44px accounts for the checkbox size, margin and the panel's padding.
        expect(Math.floor(firstOptionRight))
          .withContext(`Expected trigger label to align along x-axis, accounting for the checkbox.`)
          .toEqual(Math.floor(triggerRight + 40));
      }));
    });

    describe('x-axis positioning with groups', () => {
      let groupFixture: ComponentFixture<SelectWithGroups>;

      beforeEach(fakeAsync(() => {
        groupFixture = TestBed.createComponent(SelectWithGroups);
        groupFixture.detectChanges();
        formField = groupFixture.debugElement.query(By.css('.mat-form-field'))!.nativeElement;
        trigger = groupFixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;

        formField.style.position = 'fixed';
        formField.style.left = '60px';
      }));

      it('should adjust for the group padding in ltr', fakeAsync(() => {
        groupFixture.componentInstance.control.setValue('oddish-1');
        groupFixture.detectChanges();

        trigger.click();
        groupFixture.detectChanges();

        groupFixture.whenStable().then(() => {
          const group = document.querySelector('.cdk-overlay-pane mat-optgroup')!;
          const triggerLeft = trigger.getBoundingClientRect().left;
          const selectedOptionLeft = group.querySelector('mat-option.mat-selected')!
              .getBoundingClientRect().left;

          // 32px is the 16px default padding plus 16px of padding when an option is in a group.
          // 32px is the 16px default padding plus 16px of padding when an option is in a group.
          expect(Math.floor(selectedOptionLeft))
            .withContext(`Expected trigger label to align along x-axis, accounting for the ` +
                         `padding in ltr.`).toEqual(Math.floor(triggerLeft - 32));
        });
      }));

      it('should adjust for the group padding in rtl', fakeAsync(() => {
        dir.value = 'rtl';
        groupFixture.componentInstance.control.setValue('oddish-1');
        groupFixture.detectChanges();

        trigger.click();
        groupFixture.detectChanges();
        flush();

        const group = document.querySelector('.cdk-overlay-pane mat-optgroup')!;
        const triggerRight = trigger.getBoundingClientRect().right;
        const selectedOptionRight = group.querySelector('mat-option.mat-selected')!
            .getBoundingClientRect().right;

        // 32px is the 16px default padding plus 16px of padding when an option is in a group.
        // 32px is the 16px default padding plus 16px of padding when an option is in a group.
        expect(Math.floor(selectedOptionRight))
          .withContext(`Expected trigger label to align along x-axis, accounting for the ` +
                       `padding in rtl.`).toEqual(Math.floor(triggerRight + 32));
      }));

      it('should not adjust if all options are within a group, except the selected one',
          fakeAsync(() => {
            groupFixture.componentInstance.control.setValue('mime-11');
            groupFixture.detectChanges();

            trigger.click();
            groupFixture.detectChanges();
            flush();

            const selected = document.querySelector('.cdk-overlay-pane mat-option.mat-selected')!;
            const selectedOptionLeft = selected.getBoundingClientRect().left;
            const triggerLeft = trigger.getBoundingClientRect().left;

            // 16px is the default option padding
            expect(Math.floor(selectedOptionLeft)).toEqual(Math.floor(triggerLeft - 16));
          }));

      it('should align the first option to the trigger, if nothing is selected', fakeAsync(() => {
        // Push down the form field so there is space for the item to completely align.
        formField.style.top = '100px';

        const menuItemHeight = 48;
        const triggerFontSize = 16;
        const triggerLineHeightEm = 1.125;
        const triggerHeight = triggerFontSize * triggerLineHeightEm;

        trigger.click();
        groupFixture.detectChanges();
        flush();

        const triggerTop = trigger.getBoundingClientRect().top;

        const option = overlayContainerElement.querySelector('.cdk-overlay-pane mat-option');
        const optionTop = option ? option.getBoundingClientRect().top : 0;

        // There appears to be a small rounding error on IE, so we verify that the value is close,
        // not exact.
        if (platform.TRIDENT) {
          const difference =
              Math.abs(optionTop + (menuItemHeight - triggerHeight) / 2 - triggerTop);
          expect(difference)
            .withContext('Expected trigger to align with the first option.').toBeLessThan(0.1);
        } else {
          expect(Math.floor(optionTop + (menuItemHeight - triggerHeight) / 2))
            .withContext('Expected trigger to align with the first option.')
            .toBe(Math.floor(triggerTop));
        }
      }));

      it('should not adjust if option centering is disabled any option under a group is selected',
        fakeAsync(() => {
          groupFixture.componentInstance.select.disableOptionCentering = true;
          groupFixture.componentInstance.control.setValue('oddish-1');
          groupFixture.detectChanges();

          trigger.click();
          groupFixture.detectChanges();
          flush();

          const selected = document.querySelector('.cdk-overlay-pane mat-option.mat-selected')!;
          const selectedOptionLeft = selected.getBoundingClientRect().left;
          const triggerLeft = trigger.getBoundingClientRect().left;

          // 16px is the default option padding
          expect(Math.floor(selectedOptionLeft)).toEqual(Math.floor(triggerLeft - 16));
        })
      );
    });
  });

  describe('with multiple selection', () => {
    beforeEach(waitForAsync(() => configureMatSelectTestingModule([
      MultiSelect,
      MultiSelectWithLotsOfOptions
    ])));

    let fixture: ComponentFixture<MultiSelect>;
    let testInstance: MultiSelect;
    let trigger: HTMLElement;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(MultiSelect);
      testInstance = fixture.componentInstance;
      fixture.detectChanges();

      trigger = fixture.debugElement.query(By.css('.mat-select-trigger'))!.nativeElement;
    }));

    it('should be able to select multiple values', fakeAsync(() => {
      trigger.click();
      fixture.detectChanges();

      const options = overlayContainerElement.querySelectorAll('mat-option') as
          NodeListOf<HTMLElement>;

      options[0].click();
      options[2].click();
      options[5].click();
      fixture.detectChanges();

      expect(testInstance.control.value).toEqual(['steak-0', 'tacos-2', 'eggs-5']);
    }));

    it('should be able to toggle an option on and off', fakeAsync(() => {
      trigger.click();
      fixture.detectChanges();

      const option = overlayContainerElement.querySelector('mat-option') as HTMLElement;

      option.click();
      fixture.detectChanges();

      expect(testInstance.control.value).toEqual(['steak-0']);

      option.click();
      fixture.detectChanges();

      expect(testInstance.control.value).toEqual([]);
    }));

    it('should update the label', fakeAsync(() => {
      trigger.click();
      fixture.detectChanges();
      flush();

      const options = overlayContainerElement.querySelectorAll('mat-option') as
          NodeListOf<HTMLElement>;

      options[0].click();
      options[2].click();
      options[5].click();
      fixture.detectChanges();

      expect(trigger.textContent).toContain('Steak, Tacos, Eggs');

      options[2].click();
      fixture.detectChanges();

      expect(trigger.textContent).toContain('Steak, Eggs');
    }));

    it('should be able to set the selected value by taking an array', fakeAsync(() => {
      trigger.click();
      testInstance.control.setValue(['steak-0', 'eggs-5']);
      fixture.detectChanges();

      const optionNodes = overlayContainerElement.querySelectorAll('mat-option') as
          NodeListOf<HTMLElement>;

      const optionInstances = testInstance.options.toArray();

      expect(optionNodes[0].classList).toContain('mat-selected');
      expect(optionNodes[5].classList).toContain('mat-selected');

      expect(optionInstances[0].selected).toBe(true);
      expect(optionInstances[5].selected).toBe(true);
    }));

    it('should override the previously-selected value when setting an array', fakeAsync(() => {
      trigger.click();
      fixture.detectChanges();

      const options = overlayContainerElement.querySelectorAll('mat-option') as
          NodeListOf<HTMLElement>;

      options[0].click();
      fixture.detectChanges();

      expect(options[0].classList).toContain('mat-selected');

      testInstance.control.setValue(['eggs-5']);
      fixture.detectChanges();

      expect(options[0].classList).not.toContain('mat-selected');
      expect(options[5].classList).toContain('mat-selected');
    }));

    it('should not close the panel when clicking on options', fakeAsync(() => {
      trigger.click();
      fixture.detectChanges();

      expect(testInstance.select.panelOpen).toBe(true);

      const options = overlayContainerElement.querySelectorAll('mat-option') as
          NodeListOf<HTMLElement>;

      options[0].click();
      options[1].click();
      fixture.detectChanges();

      expect(testInstance.select.panelOpen).toBe(true);
    }));

    it('should sort the selected options based on their order in the panel', fakeAsync(() => {
      trigger.click();
      fixture.detectChanges();
      flush();

      const options = overlayContainerElement.querySelectorAll('mat-option') as
          NodeListOf<HTMLElement>;

      options[2].click();
      options[0].click();
      options[1].click();
      fixture.detectChanges();

      expect(trigger.textContent).toContain('Steak, Pizza, Tacos');
      expect(fixture.componentInstance.control.value).toEqual(['steak-0', 'pizza-1', 'tacos-2']);
    }));

    it('should sort the selected options in reverse in rtl', fakeAsync(() => {
      dir.value = 'rtl';
      trigger.click();
      fixture.detectChanges();
      flush();

      const options = overlayContainerElement.querySelectorAll('mat-option') as
          NodeListOf<HTMLElement>;

      options[2].click();
      options[0].click();
      options[1].click();
      fixture.detectChanges();

      expect(trigger.textContent).toContain('Tacos, Pizza, Steak');
      expect(fixture.componentInstance.control.value).toEqual(['steak-0', 'pizza-1', 'tacos-2']);
    }));

    it('should be able to customize the value sorting logic', fakeAsync(() => {
      fixture.componentInstance.sortComparator = (a, b, optionsArray) => {
        return optionsArray.indexOf(b) - optionsArray.indexOf(a);
      };
      fixture.detectChanges();

      trigger.click();
      fixture.detectChanges();
      flush();

      const options = overlayContainerElement.querySelectorAll('mat-option') as
          NodeListOf<HTMLElement>;

      for (let i = 0; i < 3; i++) {
        options[i].click();
      }
      fixture.detectChanges();

      // Expect the items to be in reverse order.
      expect(trigger.textContent).toContain('Tacos, Pizza, Steak');
      expect(fixture.componentInstance.control.value).toEqual(['tacos-2', 'pizza-1', 'steak-0']);
    }));

    it('should sort the values that get set via the model based on the panel order',
        fakeAsync(() => {
          trigger.click();
          fixture.detectChanges();

          testInstance.control.setValue(['tacos-2', 'steak-0', 'pizza-1']);
          fixture.detectChanges();

          expect(trigger.textContent).toContain('Steak, Pizza, Tacos');
        }));

    it('should reverse sort the values, that get set via the model in rtl', fakeAsync(() => {
      dir.value = 'rtl';
      trigger.click();
      fixture.detectChanges();

      testInstance.control.setValue(['tacos-2', 'steak-0', 'pizza-1']);
      fixture.detectChanges();

      expect(trigger.textContent).toContain('Tacos, Pizza, Steak');
    }));

    it('should throw an exception when trying to set a non-array value', fakeAsync(() => {
      expect(() => {
        testInstance.control.setValue('not-an-array');
      }).toThrowError(wrappedErrorMessage(getMatSelectNonArrayValueError()));
    }));

    it('should throw an exception when trying to change multiple mode after init', fakeAsync(() => {
      expect(() => {
        testInstance.select.multiple = false;
      }).toThrowError(wrappedErrorMessage(getMatSelectDynamicMultipleError()));
    }));

    it('should pass the `multiple` value to all of the option instances', fakeAsync(() => {
      trigger.click();
      fixture.detectChanges();
      flush();

      expect(testInstance.options.toArray().every(option => !!option.multiple))
        .withContext('Expected `multiple` to have been added to initial set of options.')
        .toBe(true);

      testInstance.foods.push({ value: 'cake-8', viewValue: 'Cake' });
      fixture.detectChanges();

      expect(testInstance.options.toArray().every(option => !!option.multiple))
        .withContext('Expected `multiple` to have been set on dynamically-added option.')
        .toBe(true);
    }));

    it('should update the active item index on click', fakeAsync(() => {
      trigger.click();
      fixture.detectChanges();
      flush();

      expect(fixture.componentInstance.select._keyManager.activeItemIndex).toBe(0);

      const options = overlayContainerElement.querySelectorAll('mat-option') as
          NodeListOf<HTMLElement>;

      options[2].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.select._keyManager.activeItemIndex).toBe(2);
    }));

    it('should be to select an option with a `null` value', fakeAsync(() => {
      fixture.componentInstance.foods = [
        { value: null, viewValue: 'Steak' },
        { value: 'pizza-1', viewValue: 'Pizza' },
        { value: null, viewValue: 'Tacos' },
      ];

      fixture.detectChanges();
      trigger.click();
      fixture.detectChanges();

      const options = overlayContainerElement.querySelectorAll('mat-option') as
          NodeListOf<HTMLElement>;

      options[0].click();
      options[1].click();
      options[2].click();
      fixture.detectChanges();

      expect(testInstance.control.value).toEqual([null, 'pizza-1', null]);
    }));

    it('should select all options when pressing ctrl + a', () => {
      const selectElement = fixture.nativeElement.querySelector('mat-select');
      const options = fixture.componentInstance.options.toArray();

      expect(testInstance.control.value).toBeFalsy();
      expect(options.every(option => option.selected)).toBe(false);

      fixture.componentInstance.select.open();
      fixture.detectChanges();

      const event = createKeyboardEvent('keydown', A, undefined, {control: true});
      dispatchEvent(selectElement, event);
      fixture.detectChanges();

      expect(options.every(option => option.selected)).toBe(true);
      expect(testInstance.control.value).toEqual([
        'steak-0',
        'pizza-1',
        'tacos-2',
        'sandwich-3',
        'chips-4',
        'eggs-5',
        'pasta-6',
        'sushi-7'
      ]);
    });

    it('should skip disabled options when using ctrl + a', () => {
      const selectElement = fixture.nativeElement.querySelector('mat-select');
      const options = fixture.componentInstance.options.toArray();

      for (let i = 0; i < 3; i++) {
        options[i].disabled = true;
      }

      expect(testInstance.control.value).toBeFalsy();

      fixture.componentInstance.select.open();
      fixture.detectChanges();

      const event = createKeyboardEvent('keydown', A, undefined, {control: true});
      dispatchEvent(selectElement, event);
      fixture.detectChanges();

      expect(testInstance.control.value).toEqual([
        'sandwich-3',
        'chips-4',
        'eggs-5',
        'pasta-6',
        'sushi-7'
      ]);
    });

    it('should select all options when pressing ctrl + a when some options are selected', () => {
      const selectElement = fixture.nativeElement.querySelector('mat-select');
      const options = fixture.componentInstance.options.toArray();

      options[0].select();
      fixture.detectChanges();

      expect(testInstance.control.value).toEqual(['steak-0']);
      expect(options.some(option => option.selected)).toBe(true);

      fixture.componentInstance.select.open();
      fixture.detectChanges();

      const event = createKeyboardEvent('keydown', A, undefined, {control: true});
      dispatchEvent(selectElement, event);
      fixture.detectChanges();

      expect(options.every(option => option.selected)).toBe(true);
      expect(testInstance.control.value).toEqual([
        'steak-0',
        'pizza-1',
        'tacos-2',
        'sandwich-3',
        'chips-4',
        'eggs-5',
        'pasta-6',
        'sushi-7'
      ]);
    });

    it('should deselect all options with ctrl + a if all options are selected', () => {
      const selectElement = fixture.nativeElement.querySelector('mat-select');
      const options = fixture.componentInstance.options.toArray();

      options.forEach(option => option.select());
      fixture.detectChanges();

      expect(testInstance.control.value).toEqual([
        'steak-0',
        'pizza-1',
        'tacos-2',
        'sandwich-3',
        'chips-4',
        'eggs-5',
        'pasta-6',
        'sushi-7'
      ]);
      expect(options.every(option => option.selected)).toBe(true);

      fixture.componentInstance.select.open();
      fixture.detectChanges();

      const event = createKeyboardEvent('keydown', A, undefined, {control: true});
      dispatchEvent(selectElement, event);
      fixture.detectChanges();

      expect(options.some(option => option.selected)).toBe(false);
      expect(testInstance.control.value).toEqual([]);
    });

    it('should not throw when selecting a large amount of options', fakeAsync(() => {
      fixture.destroy();

      const lotsOfOptionsFixture = TestBed.createComponent(MultiSelectWithLotsOfOptions);

      expect(() => {
        lotsOfOptionsFixture.componentInstance.checkAll();
        lotsOfOptionsFixture.detectChanges();
        flush();
      }).not.toThrow();
    }));

    it('should be able to programmatically set an array with duplicate values', fakeAsync(() => {
      testInstance.foods = [
        { value: 'steak-0', viewValue: 'Steak' },
        { value: 'pizza-1', viewValue: 'Pizza' },
        { value: 'pizza-1', viewValue: 'Pizza' },
        { value: 'pizza-1', viewValue: 'Pizza' },
        { value: 'pizza-1', viewValue: 'Pizza' },
        { value: 'pizza-1', viewValue: 'Pizza' },
      ];
      fixture.detectChanges();
      testInstance.control.setValue(['steak-0', 'pizza-1', 'pizza-1', 'pizza-1']);
      fixture.detectChanges();

      trigger.click();
      fixture.detectChanges();

      const optionNodes = Array.from(overlayContainerElement.querySelectorAll('mat-option'));
      const optionInstances = testInstance.options.toArray();

      expect(optionNodes.map(node => node.classList.contains('mat-selected')))
        .toEqual([true, true, true, true, false, false]);

      expect(optionInstances.map(instance => instance.selected))
        .toEqual([true, true, true, true, false, false]);
    }));

    it('should update the option selected state if the same array is mutated and passed back in',
      fakeAsync(() => {
        const value: string[] = [];
        trigger.click();
        testInstance.control.setValue(value);
        fixture.detectChanges();

        const optionNodes =
            Array.from<HTMLElement>(overlayContainerElement.querySelectorAll('mat-option'));
        const optionInstances = testInstance.options.toArray();

        expect(optionNodes.some(option => option.classList.contains('mat-selected'))).toBe(false);
        expect(optionInstances.some(option => option.selected)).toBe(false);

        value.push('eggs-5');
        testInstance.control.setValue(value);
        fixture.detectChanges();

        expect(optionNodes[5].classList).toContain('mat-selected');
        expect(optionInstances[5].selected).toBe(true);
      }));

  });

  it('should be able to provide default values through an injection token', fakeAsync(() => {
    configureMatSelectTestingModule([NgModelSelect], [{
      provide: MAT_SELECT_CONFIG,
      useValue: {
        disableOptionCentering: true,
        typeaheadDebounceInterval: 1337,
        overlayPanelClass: 'test-panel-class',
      } as MatSelectConfig
    }]);
    const fixture = TestBed.createComponent(NgModelSelect);
    fixture.detectChanges();
    const select = fixture.componentInstance.select;
    select.open();
    fixture.detectChanges();
    flush();

    expect(select.disableOptionCentering).toBe(true);
    expect(select.typeaheadDebounceInterval).toBe(1337);
    expect(document.querySelector('.cdk-overlay-pane')?.classList).toContain('test-panel-class');
  }));

  it('should not not throw if the select is inside an ng-container with ngIf', fakeAsync(() => {
    configureMatSelectTestingModule([SelectInNgContainer]);
    const fixture = TestBed.createComponent(SelectInNgContainer);
    expect(() => fixture.detectChanges()).not.toThrow();
  }));

});


@Component({
  selector: 'basic-select',
  template: `
    <div [style.height.px]="heightAbove"></div>
    <mat-form-field>
      <mat-select placeholder="Food" [formControl]="control" [required]="isRequired"
        [tabIndex]="tabIndexOverride" [aria-label]="ariaLabel" [aria-labelledby]="ariaLabelledby"
        [panelClass]="panelClass" [disableRipple]="disableRipple"
        [typeaheadDebounceInterval]="typeaheadDebounceInterval">
        <mat-option *ngFor="let food of foods" [value]="food.value" [disabled]="food.disabled">
          {{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
    <div [style.height.px]="heightBelow"></div>
  `
})
class BasicSelect {
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'tacos-2', viewValue: 'Tacos', disabled: true },
    { value: 'sandwich-3', viewValue: 'Sandwich' },
    { value: 'chips-4', viewValue: 'Chips' },
    { value: 'eggs-5', viewValue: 'Eggs' },
    { value: 'pasta-6', viewValue: 'Pasta' },
    { value: 'sushi-7', viewValue: 'Sushi' },
  ];
  control = new FormControl();
  isRequired: boolean;
  heightAbove = 0;
  heightBelow = 0;
  tabIndexOverride: number;
  ariaLabel: string;
  ariaLabelledby: string;
  panelClass = ['custom-one', 'custom-two'];
  disableRipple: boolean;
  typeaheadDebounceInterval: number;

  @ViewChild(MatSelect, {static: true}) select: MatSelect;
  @ViewChildren(MatOption) options: QueryList<MatOption>;
}

@Component({
  selector: 'ng-model-select',
  template: `
    <mat-form-field>
      <mat-select placeholder="Food" ngModel [disabled]="isDisabled">
        <mat-option *ngFor="let food of foods"
                    [value]="food.value">{{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class NgModelSelect {
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'tacos-2', viewValue: 'Tacos' },
  ];
  isDisabled: boolean;

  @ViewChild(MatSelect) select: MatSelect;
  @ViewChildren(MatOption) options: QueryList<MatOption>;
}

@Component({
  selector: 'many-selects',
  template: `
    <mat-form-field>
      <mat-select placeholder="First">
        <mat-option value="one">one</mat-option>
        <mat-option value="two">two</mat-option>
      </mat-select>
    </mat-form-field>
    <mat-form-field>
      <mat-select placeholder="Second">
        <mat-option value="three">three</mat-option>
        <mat-option value="four">four</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class ManySelects {}

@Component({
  selector: 'ng-if-select',
  template: `
    <div *ngIf="isShowing">
      <mat-form-field>
        <mat-select placeholder="Food I want to eat right now" [formControl]="control">
          <mat-option *ngFor="let food of foods" [value]="food.value">
            {{ food.viewValue }}
          </mat-option>
        </mat-select>
      </mat-form-field>
    </div>
  `,
})
class NgIfSelect {
  isShowing = false;
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'tacos-2', viewValue: 'Tacos'}
  ];
  control = new FormControl('pizza-1');

  @ViewChild(MatSelect) select: MatSelect;
}

@Component({
  selector: 'select-with-change-event',
  template: `
    <mat-form-field>
      <mat-select (selectionChange)="changeListener($event)">
        <mat-option *ngFor="let food of foods" [value]="food">{{ food }}</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class SelectWithChangeEvent {
  foods: string[] = [
    'steak-0',
    'pizza-1',
    'tacos-2',
    'sandwich-3',
    'chips-4',
    'eggs-5',
    'pasta-6',
    'sushi-7'
  ];

  changeListener = jasmine.createSpy('MatSelect change listener');
}

@Component({
  selector: 'select-init-without-options',
  template: `
    <mat-form-field>
      <mat-select placeholder="Food I want to eat right now" [formControl]="control">
        <mat-option *ngFor="let food of foods" [value]="food.value">
          {{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class SelectInitWithoutOptions {
  foods: any[];
  control = new FormControl('pizza-1');

  @ViewChild(MatSelect) select: MatSelect;
  @ViewChildren(MatOption) options: QueryList<MatOption>;

  addOptions() {
    this.foods = [
      { value: 'steak-0', viewValue: 'Steak' },
      { value: 'pizza-1', viewValue: 'Pizza' },
      { value: 'tacos-2', viewValue: 'Tacos'}
    ];
  }
}

@Component({
  selector: 'custom-select-accessor',
  template: `<mat-form-field><mat-select></mat-select></mat-form-field>`,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: CustomSelectAccessor,
    multi: true
  }]
})
class CustomSelectAccessor implements ControlValueAccessor {
  @ViewChild(MatSelect) select: MatSelect;

  writeValue: (value?: any) => void = () => {};
  registerOnChange: (changeFn?: (value: any) => void) => void = () => {};
  registerOnTouched: (touchedFn?: () => void) => void = () => {};
}

@Component({
  selector: 'comp-with-custom-select',
  template: `<custom-select-accessor [formControl]="ctrl"></custom-select-accessor>`,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: CustomSelectAccessor,
    multi: true
  }]
})
class CompWithCustomSelect {
  ctrl = new FormControl('initial value');
  @ViewChild(CustomSelectAccessor, {static: true}) customAccessor: CustomSelectAccessor;
}

@Component({
  selector: 'select-infinite-loop',
  template: `
    <mat-form-field>
      <mat-select [(ngModel)]="value"></mat-select>
    </mat-form-field>
    <throws-error-on-init></throws-error-on-init>
  `
})
class SelectWithErrorSibling {
  value: string;
}

@Component({
  selector: 'throws-error-on-init',
  template: ''
})
class ThrowsErrorOnInit implements OnInit {
  ngOnInit() {
    throw Error('Oh no!');
  }
}

@Component({
  selector: 'basic-select-on-push',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field>
      <mat-select placeholder="Food" [formControl]="control">
        <mat-option *ngFor="let food of foods" [value]="food.value">
          {{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class BasicSelectOnPush {
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'tacos-2', viewValue: 'Tacos' },
  ];
  control = new FormControl();
}

@Component({
  selector: 'basic-select-on-push-preselected',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field>
      <mat-select placeholder="Food" [formControl]="control">
        <mat-option *ngFor="let food of foods" [value]="food.value">
          {{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class BasicSelectOnPushPreselected {
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'tacos-2', viewValue: 'Tacos' },
  ];
  control = new FormControl('pizza-1');
}

@Component({
  selector: 'floating-label-select',
  template: `
    <mat-form-field [floatLabel]="floatLabel">
      <mat-select [placeholder]="placeholder" [formControl]="control">
        <mat-option *ngFor="let food of foods" [value]="food.value">
          {{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
    `,
})
class FloatLabelSelect {
  floatLabel: FloatLabelType | null = 'auto';
  placeholder = 'Food I want to eat right now';
  control = new FormControl();
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'tacos-2', viewValue: 'Tacos'}
  ];

  @ViewChild(MatSelect) select: MatSelect;
}

@Component({
  selector: 'multi-select',
  template: `
    <mat-form-field>
      <mat-select multiple placeholder="Food" [formControl]="control"
        [sortComparator]="sortComparator">
        <mat-option *ngFor="let food of foods"
                    [value]="food.value">{{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class MultiSelect {
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'tacos-2', viewValue: 'Tacos' },
    { value: 'sandwich-3', viewValue: 'Sandwich' },
    { value: 'chips-4', viewValue: 'Chips' },
    { value: 'eggs-5', viewValue: 'Eggs' },
    { value: 'pasta-6', viewValue: 'Pasta' },
    { value: 'sushi-7', viewValue: 'Sushi' },
  ];
  control = new FormControl();

  @ViewChild(MatSelect) select: MatSelect;
  @ViewChildren(MatOption) options: QueryList<MatOption>;
  sortComparator: (a: MatOption, b: MatOption, options: MatOption[]) => number;
}

@Component({
  selector: 'select-with-plain-tabindex',
  template: `<mat-form-field><mat-select tabindex="5"></mat-select></mat-form-field>`
})
class SelectWithPlainTabindex { }

@Component({
  selector: 'select-early-sibling-access',
  template: `
    <mat-form-field>
      <mat-select #select="matSelect"></mat-select>
    </mat-form-field>
    <div *ngIf="select.selected"></div>
  `
})
class SelectEarlyAccessSibling { }

@Component({
  selector: 'basic-select-initially-hidden',
  template: `
    <mat-form-field>
      <mat-select [style.display]="isVisible ? 'block' : 'none'">
        <mat-option value="value">There are no other options</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class BasicSelectInitiallyHidden {
  isVisible = false;
}

@Component({
  selector: 'basic-select-no-placeholder',
  template: `
    <mat-form-field>
      <mat-select>
        <mat-option value="value">There are no other options</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class BasicSelectNoPlaceholder { }

@Component({
  selector: 'basic-select-with-theming',
  template: `
    <mat-form-field [color]="theme">
      <mat-select placeholder="Food">
        <mat-option value="steak-0">Steak</mat-option>
        <mat-option value="pizza-1">Pizza</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class BasicSelectWithTheming {
  @ViewChild(MatSelect) select: MatSelect;
  theme: string;
}

@Component({
  selector: 'reset-values-select',
  template: `
    <mat-form-field>
      <mat-select [formControl]="control">
        <mat-option *ngFor="let food of foods" [value]="food.value">
          {{ food.viewValue }}
        </mat-option>
        <mat-option>None</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class ResetValuesSelect {
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'tacos-2', viewValue: 'Tacos' },
    { value: false, viewValue: 'Falsy' },
    { viewValue: 'Undefined' },
    { value: null, viewValue: 'Null' },
  ];
  control = new FormControl();

  @ViewChild(MatSelect) select: MatSelect;
}

@Component({
  template: `
    <mat-form-field>
      <mat-select [formControl]="control">
        <mat-option *ngFor="let food of foods"
                    [value]="food.value">{{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class FalsyValueSelect {
  foods: any[] = [
    { value: 0, viewValue: 'Steak' },
    { value: 1, viewValue: 'Pizza' },
  ];
  control = new FormControl();
  @ViewChildren(MatOption) options: QueryList<MatOption>;
}

@Component({
  selector: 'select-with-groups',
  template: `
    <mat-form-field>
      <mat-select placeholder="Pokemon" [formControl]="control">
        <mat-optgroup *ngFor="let group of pokemonTypes" [label]="group.name"
          [disabled]="group.disabled">
          <mat-option *ngFor="let pokemon of group.pokemon" [value]="pokemon.value">
            {{ pokemon.viewValue }}
          </mat-option>
        </mat-optgroup>
        <mat-option value="mime-11">Mr. Mime</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class SelectWithGroups {
  control = new FormControl();
  pokemonTypes = [
    {
      name: 'Grass',
      pokemon: [
        { value: 'bulbasaur-0', viewValue: 'Bulbasaur' },
        { value: 'oddish-1', viewValue: 'Oddish' },
        { value: 'bellsprout-2', viewValue: 'Bellsprout' }
      ]
    },
    {
      name: 'Water',
      disabled: true,
      pokemon: [
        { value: 'squirtle-3', viewValue: 'Squirtle' },
        { value: 'psyduck-4', viewValue: 'Psyduck' },
        { value: 'horsea-5', viewValue: 'Horsea' }
      ]
    },
    {
      name: 'Fire',
      pokemon: [
        { value: 'charmander-6', viewValue: 'Charmander' },
        { value: 'vulpix-7', viewValue: 'Vulpix' },
        { value: 'flareon-8', viewValue: 'Flareon' }
      ]
    },
    {
      name: 'Psychic',
      pokemon: [
        { value: 'mew-9', viewValue: 'Mew' },
        { value: 'mewtwo-10', viewValue: 'Mewtwo' },
      ]
    }
  ];

  @ViewChild(MatSelect) select: MatSelect;
  @ViewChildren(MatOption) options: QueryList<MatOption>;
}

@Component({
  selector: 'select-with-indirect-groups',
  // Note that we need the blank `ngSwitch` in order to have
  // a directive between `mat-select` and `mat-optgroup`.
  template: `
    <mat-form-field>
      <mat-select placeholder="Pokemon" [formControl]="control">
        <ng-container [ngSwitch]="true">
          <mat-optgroup *ngFor="let group of pokemonTypes" [label]="group.name"
            [disabled]="group.disabled">
            <mat-option *ngFor="let pokemon of group.pokemon" [value]="pokemon.value">
              {{ pokemon.viewValue }}
            </mat-option>
          </mat-optgroup>
          <mat-option value="mime-11">Mr. Mime</mat-option>
        </ng-container>
      </mat-select>
    </mat-form-field>
  `
})
class SelectWithIndirectDescendantGroups extends SelectWithGroups {
}

@Component({
  selector: 'select-with-groups',
  template: `
    <mat-form-field>
      <mat-select placeholder="Pokemon" [formControl]="control">
        <mat-optgroup *ngFor="let group of pokemonTypes" [label]="group.name">
          <ng-container *ngFor="let pokemon of group.pokemon">
            <mat-option [value]="pokemon.value">{{ pokemon.viewValue }}</mat-option>
          </ng-container>
        </mat-optgroup>
      </mat-select>
    </mat-form-field>
  `
})
class SelectWithGroupsAndNgContainer {
  control = new FormControl();
  pokemonTypes = [
    {
      name: 'Grass',
      pokemon: [{ value: 'bulbasaur-0', viewValue: 'Bulbasaur' }]
    }
  ];
}

@Component({
  template: `
    <form>
      <mat-form-field>
        <mat-select [(ngModel)]="value"></mat-select>
      </mat-form-field>
    </form>
  `
})
class InvalidSelectInForm {
  value: any;
}

@Component({
  template: `
    <form [formGroup]="formGroup">
      <mat-form-field>
        <mat-select placeholder="Food" formControlName="food">
          <mat-option *ngFor="let option of options" [value]="option.value">
            {{option.viewValue}}
          </mat-option>
        </mat-select>

        <mat-error>This field is required</mat-error>
      </mat-form-field>
    </form>
  `
})
class SelectInsideFormGroup {
  @ViewChild(FormGroupDirective) formGroupDirective: FormGroupDirective;
  @ViewChild(MatSelect) select: MatSelect;
  options = [
    {value: 'steak-0', viewValue: 'Steak'},
    {value: 'pizza-1', viewValue: 'Pizza'},
  ];
  formControl = new FormControl('', Validators.required);
  formGroup = new FormGroup({
    food: this.formControl
  });
}

@Component({
  template: `
    <mat-form-field>
      <mat-select placeholder="Food" [(value)]="selectedFood">
        <mat-option *ngFor="let food of foods" [value]="food.value">
          {{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class BasicSelectWithoutForms {
  selectedFood: string | null;
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'sandwich-2', viewValue: 'Sandwich' },
  ];

  @ViewChild(MatSelect) select: MatSelect;
}

@Component({
  template: `
    <mat-form-field>
      <mat-select placeholder="Food" [(value)]="selectedFood">
        <mat-option *ngFor="let food of foods" [value]="food.value">
          {{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class BasicSelectWithoutFormsPreselected {
  selectedFood = 'pizza-1';
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
  ];

  @ViewChild(MatSelect) select: MatSelect;
}

@Component({
  template: `
    <mat-form-field>
      <mat-select placeholder="Food" [(value)]="selectedFoods" multiple>
        <mat-option *ngFor="let food of foods" [value]="food.value">
          {{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class BasicSelectWithoutFormsMultiple {
  selectedFoods: string[];
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'sandwich-2', viewValue: 'Sandwich' },
  ];

  @ViewChild(MatSelect) select: MatSelect;
}

@Component({
  selector: 'select-with-custom-trigger',
  template: `
    <mat-form-field>
      <mat-select placeholder="Food" [formControl]="control" #select="matSelect">
        <mat-select-trigger>
          {{ select.selected?.viewValue.split('').reverse().join('') }}
        </mat-select-trigger>
        <mat-option *ngFor="let food of foods" [value]="food.value">
          {{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class SelectWithCustomTrigger {
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
  ];
  control = new FormControl();
}

@Component({
  selector: 'ng-model-compare-with',
  template: `
    <mat-form-field>
      <mat-select [ngModel]="selectedFood" (ngModelChange)="setFoodByCopy($event)"
                 [compareWith]="comparator">
        <mat-option *ngFor="let food of foods" [value]="food">{{ food.viewValue }}</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class NgModelCompareWithSelect {
  foods: ({value: string, viewValue: string})[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'tacos-2', viewValue: 'Tacos' },
  ];
  selectedFood: {value: string, viewValue: string} = { value: 'pizza-1', viewValue: 'Pizza' };
  comparator: ((f1: any, f2: any) => boolean)|null = this.compareByValue;

  @ViewChild(MatSelect) select: MatSelect;
  @ViewChildren(MatOption) options: QueryList<MatOption>;

  useCompareByValue() { this.comparator = this.compareByValue; }

  useCompareByReference() { this.comparator = this.compareByReference; }

  useNullComparator() { this.comparator = null; }

  compareByValue(f1: any, f2: any) { return f1 && f2 && f1.value === f2.value; }

  compareByReference(f1: any, f2: any) { return f1 === f2; }

  setFoodByCopy(newValue: {value: string, viewValue: string}) {
    this.selectedFood = {...{}, ...newValue};
  }
}

@Component({
  template: `
    <mat-select placeholder="Food" [formControl]="control" [errorStateMatcher]="errorStateMatcher">
      <mat-option *ngFor="let food of foods" [value]="food.value">
        {{ food.viewValue }}
      </mat-option>
    </mat-select>
  `
})
class CustomErrorBehaviorSelect {
  @ViewChild(MatSelect) select: MatSelect;
  control = new FormControl();
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
  ];
  errorStateMatcher: ErrorStateMatcher;
}

@Component({
  template: `
    <mat-form-field>
      <mat-select placeholder="Food" [(ngModel)]="selectedFoods">
        <mat-option *ngFor="let food of foods"
                    [value]="food.value">{{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class SingleSelectWithPreselectedArrayValues {
  foods: any[] = [
    { value: ['steak-0', 'steak-1'], viewValue: 'Steak' },
    { value: ['pizza-1', 'pizza-2'], viewValue: 'Pizza' },
    { value: ['tacos-2', 'tacos-3'], viewValue: 'Tacos' },
  ];

  selectedFoods = this.foods[1].value;

  @ViewChild(MatSelect) select: MatSelect;
  @ViewChildren(MatOption) options: QueryList<MatOption>;
}

@Component({
  selector: 'select-without-option-centering',
  template: `
    <mat-form-field>
      <mat-select placeholder="Food" [formControl]="control" disableOptionCentering>
        <mat-option *ngFor="let food of foods" [value]="food.value">
          {{ food.viewValue }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class SelectWithoutOptionCentering {
  foods: any[] = [
    { value: 'steak-0', viewValue: 'Steak' },
    { value: 'pizza-1', viewValue: 'Pizza' },
    { value: 'tacos-2', viewValue: 'Tacos'},
    { value: 'sandwich-3', viewValue: 'Sandwich' },
    { value: 'chips-4', viewValue: 'Chips' },
    { value: 'eggs-5', viewValue: 'Eggs' },
    { value: 'pasta-6', viewValue: 'Pasta' },
    { value: 'sushi-7', viewValue: 'Sushi' },
  ];
  control = new FormControl('pizza-1');

  @ViewChild(MatSelect) select: MatSelect;
  @ViewChildren(MatOption) options: QueryList<MatOption>;
}

@Component({
  template: `
    <mat-form-field>
      <mat-label>Select a thing</mat-label>

      <mat-select [placeholder]="placeholder">
        <mat-option value="thing">A thing</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class SelectWithFormFieldLabel {
  placeholder: string;
}

@Component({
  template: `
    <mat-form-field appearance="fill">
      <mat-label>Select something</mat-label>
      <mat-select *ngIf="showSelect">
        <mat-option value="1">One</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class SelectWithNgIfAndLabel {
  showSelect = true;
}

@Component({
  template: `
    <mat-form-field>
      <mat-select multiple [ngModel]="value">
        <mat-option *ngFor="let item of items" [value]="item">{{item}}</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class MultiSelectWithLotsOfOptions {
  items = new Array(1000).fill(0).map((_, i) => i);
  value: number[] = [];

  checkAll() {
    this.value = [...this.items];
  }

  uncheckAll() {
    this.value = [];
  }
}


@Component({
  selector: 'basic-select-with-reset',
  template: `
    <mat-form-field>
      <mat-select [formControl]="control">
        <mat-option>Reset</mat-option>
        <mat-option value="a">A</mat-option>
        <mat-option value="b">B</mat-option>
        <mat-option value="c">C</mat-option>
      </mat-select>
    </mat-form-field>
  `
})
class SelectWithResetOptionAndFormControl {
  @ViewChild(MatSelect) select: MatSelect;
  @ViewChildren(MatOption) options: QueryList<MatOption>;
  control = new FormControl();
}


@Component({
  selector: 'select-with-placeholder-in-ngcontainer-with-ngIf',
  template: `
    <mat-form-field>
      <ng-container *ngIf="true">
        <mat-select placeholder="Product Area">
          <mat-option value="a">A</mat-option>
          <mat-option value="b">B</mat-option>
          <mat-option value="c">C</mat-option>
        </mat-select>
      </ng-container>
    </mat-form-field>
  `
})
class SelectInNgContainer {}
